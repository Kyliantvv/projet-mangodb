from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os

app = FastAPI(title="User Profiles API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "userprofiles")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
users_col = db["users"]


class Address(BaseModel):
    street: str
    city: str
    country: str


class Preferences(BaseModel):
    theme: str = "light"
    notifications: bool = True


class UserCreate(BaseModel):
    name: str
    email: str
    addresses: list[Address] = []
    preferences: Preferences = Preferences()


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    addresses: Optional[list[Address]] = None
    preferences: Optional[Preferences] = None


def serialize(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def get_user_or_404(user_id: str) -> dict:
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    doc = users_col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return doc


@app.get("/users")
def list_users():
    return [serialize(u) for u in users_col.find()]


@app.get("/users/advanced")
def advanced_query():
    pipeline = [
        {
            "$match": {
                "preferences.notifications": True,
                "$expr": {"$gt": [{"$size": "$addresses"}, 1]}
            }
        },
        {"$sort": {"name": 1}},
        {"$project": {"_id": 1, "name": 1, "email": 1, "addresses": 1, "preferences": 1}}
    ]
    return [serialize(u) for u in users_col.aggregate(pipeline)]


@app.get("/users/sorted")
def sorted_users():
    pipeline = [
        {"$sort": {"name": 1}},
        {"$project": {"_id": 1, "name": 1, "addresses": 1, "preferences": 1, "created_at": 1}}
    ]
    return [serialize(u) for u in users_col.aggregate(pipeline)]


@app.put("/users/set-premium", status_code=status.HTTP_200_OK)
def set_premium():
    result = users_col.update_many(
        {"$expr": {"$gte": [{"$size": "$addresses"}, 2]}},
        {"$set": {"premium": True}}
    )
    return {"updated": result.modified_count}


@app.get("/users/{user_id}")
def get_user(user_id: str):
    return serialize(get_user_or_404(user_id))


@app.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate):
    doc = user.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    result = users_col.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@app.put("/users/{user_id}")
def update_user(user_id: str, user: UserUpdate):
    get_user_or_404(user_id)
    updates = {k: v for k, v in user.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    return serialize(users_col.find_one({"_id": ObjectId(user_id)}))


@app.delete("/users/{user_id}")
def delete_user(user_id: str):
    get_user_or_404(user_id)
    users_col.delete_one({"_id": ObjectId(user_id)})
    return {"message": "Utilisateur supprimé avec succès"}
