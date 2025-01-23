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
        const submissionCollection = database.collection('submissions')
        const userCollection = database.collection('users')

        // task related apis
        app.get('/tasks', async (req, res) => {
            const result = await taskCollection.find().toArray()
            res.send(result)
        })

        app.get('/tasks/:email', async (req, res) => {
            const email = req.params.email
            const query = { buyer_email: email }
            const result = await taskCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/task/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await taskCollection.findOne(query)
            res.send(result)
        })

        app.post('/tasks', async (req, res) => {
            const task = req.body
            const result = await taskCollection.insertOne(task)
            res.send(result)
        })

        app.delete('/task/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await taskCollection.deleteOne(query)
            res.send(result)
        })


        // submission related apis

        // all submission by single worker
        app.get('/submissions/:email', async(req, res)=>{
            const email = req.params.email
            const query = {worker_email: email}
            const result = await submissionCollection.find(query).toArray()
            res.send(result)
        })

        // buyer task submissions
        app.get('/submission/:email', async(req, res)=>{
            const email = req.params.email
            const query = {buyer_email: email}
            const result = await submissionCollection.find(query).toArray()
            res.send(result)
        })

        // worker posting submission
        app.post('/submissions', async (req, res) => {
            const submission = req.body
            const result = await submissionCollection.insertOne(submission)

            const query = { _id: new ObjectId(submission.task_id) }
            const updatedTask = {
                $inc: {
                    required_workers: -1, // Decrement required_workers by 1
                }
            }
            const taskRes = await taskCollection.updateOne(query, updatedTask) 

            res.send(result)
        })

        // submission approve
        app.patch('/submit/:id', async(req, res)=>{
            const id = req.params.id

            const query = {_id: new ObjectId(id)}
            const updatedStatus = {
                $set:{
                    status : 'approved'
                }
            }
            const result = await submissionCollection.updateOne(query, updatedStatus)
            
            const submission = await submissionCollection.findOne(query)
            const workerQuery = {email: submission.worker_email}
            const updateUserCoin = {
                $inc: {
                    coin: + submission.payable_amount, // Decrement required_workers by 1
                }
            }
            const UserCoinRes = await userCollection.updateOne(workerQuery, updateUserCoin)

            res.send(result)
        })


        // users related apis

        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })

        app.get('/topworkers', async (req, res) => {
            const query = { role: 'worker' }
            const result = await userCollection.find(query).sort({ coin: -1 }).limit(6).toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists', insertId: null })
            }

            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id
            const { role: newRole } = req.body
            const query = { _id: new ObjectId(id) }
            const updatedRole = {
                $set: {
                    role: newRole
                }
            }
            const options = { upsert: true };
            const result = await userCollection.updateOne(query, updatedRole, options)
            res.send(result)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
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