const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleweres
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mhwjc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const database = client.db('nanotasks_db')
        const taskCollection = database.collection('tasks')
        const userCollection = database.collection('users')

        // task related apis
        app.get('/tasks', async (req, res) => {
            const result = await taskCollection.find().toArray()
            res.send(result)
        })

        app.get('/tasks/:email', async(req, res)=>{
            const email = req.params.email
            const query = {buyer_email: email}
            const result = await taskCollection.find(query).toArray()
            res.send(result)
        })

        app.post ('/tasks', async(req, res)=>{
            const task = req.body
            const result = await taskCollection.insertOne(task)
            res.send(result)
        })

        app.delete('/task/:id', async (req, res) => {
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const result = await taskCollection.deleteOne(query)
            res.send(result)
        })


        // users related apis
        
        app.get('/users', async(req, res)=>{
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.get('/user/:email', async(req, res)=>{
            const email = req.params.email
            const query = { email : email}
            const result = await userCollection.findOne(query)
            res.send(result)
        })

        app.post('/users', async(req, res)=>{
            const user = req.body 
            const result = await userCollection.insertOne(user)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('NanoTasks server')
})

app.listen(port, () => {
    console.log(`server running on port: ${port}`);
})