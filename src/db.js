import { MongoClient } from "mongodb";

export async function connectDatabase({mongoUri, dbName}) {
    const client = new MongoClient(mongoUri,{serverSelectionTimeoutMS: 5000});
    
    try{
        await client.connect();

        const db = client.db(dbName);
        await db.command({ping: 1});

        return {client, db};
    }catch(error){
        await client.close();
        throw error;
    }
}

export async function ensureIndexes(db) {
    await db.collection('nodes').createIndex({ancestors: 1});


    await db.collection('users').createIndex(
        {email:1},
        {unique: true},
    );

    await db.collection('users').createIndex({
        nodeId:1,
        role: 1,
        _id: 1,
    });
}