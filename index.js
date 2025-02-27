const express = require('express')
const cors = require('cors')
const app = express()
var jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleweres
app.use(cors({
    origin: ['http://localhost:5173'], // Allow frontend origin
    credentials: true // Allow cookies, authorization headers
}));
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mhwjc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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
        const withdrawCollection = database.collection('withdraws')
        const packageCollection = database.collection('packages')
        const paymentCollection = database.collection('payments')
        const notificationCollection = database.collection('notifications')


        // jwt apis
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '6h' })
            res.send({ token })
        })

        // middlewares
        const varifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
                if (error) {
                    return res.status(403).send({ message: 'Forbidden access' })
                }

                req.decoded = decoded
                next()
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }


        const verifyBuyer = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isBuyer = user?.role === 'buyer'
            if (!isBuyer) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifyWorker = async (req, res, next) => {

            if (!req.decoded || !req.decoded.email) {
                return res.status(403).send({ error: 'Unauthorized access' });
            }
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isWorker = user?.role === 'worker'
            if (!isWorker) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }





        // role check api

        // admin
        app.get('/user/admin/:email', varifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }

            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })

        // buyer
        app.get('/user/buyer/:email', varifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded?.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }

            const query = { email: email }
            const user = await userCollection.findOne(query)
            let buyer = false
            if (user) {
                buyer = user?.role === 'buyer'
            }
            res.send({ buyer })
        })


        // worker
        app.get('/user/worker/:email', varifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded?.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }

            const query = { email: email }
            const user = await userCollection.findOne(query)
            let worker = false
            if (user) {
                worker = user?.role === 'worker'
            }
            res.send({ worker })
        })




        // task related apis

        // admin & worker access
        app.get('/tasks', varifyToken, async (req, res) => {
            const query = { required_workers : { $gt: 0 } }
            const result = await taskCollection.find(query).toArray()
            res.send(result)
        })

        // tasks posted by buyer, buyer access
        app.get('/tasks/:email', varifyToken, verifyBuyer, async (req, res) => {
            const email = req.params.email
            const query = { buyer_email: email }
            const result = await taskCollection.find(query).toArray()
            res.send(result)
        })

        // task details, worker & buyer access
        app.get('/task/:id', varifyToken, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await taskCollection.findOne(query)
            res.send(result)
        })


        // top worker task
        app.get('/toptasks', async (req, res) => {
            const result = await taskCollection.find().sort({ required_workers: -1 }).limit(6).toArray()
            res.send(result)
        })

        // buyer posting tasks, buyer access
        app.post('/tasks', varifyToken, verifyBuyer, async (req, res) => {
            const task = req.body
            const result = await taskCollection.insertOne(task)
            res.send(result)
        })

        // buyer editing task
        app.patch('/task/:id', varifyToken, verifyBuyer, async (req, res) => {
            const id = req.params.id
            console.log(id);
            const info = req.body
            console.log(info);
            const query = { _id: new ObjectId(id) }
            const updatedTask = {
                $set: {
                    task_title: info.task_title,
                    task_detail: info.task_detail,
                    submission_info: info.submission_info
                }
            }
            console.log(updatedTask);
            const result = await taskCollection.updateOne(query, updatedTask)
            res.send(result)
        })

        // buyer & admin deleting task
        app.delete('/task/:id', varifyToken, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }

            const task = await taskCollection.findOne(query)
            const buyerEmail = task.buyer_email
            const buyerQuery = { email: buyerEmail }
            const updatedBuyerCoin = {
                $inc: {
                    coin: + (task.required_workers * task.payable_amount), //increasing buyer coin
                }
            }
            const userCoinRes = await userCollection.updateOne(buyerQuery, updatedBuyerCoin)
            // finally deleting after buyers coin update
            const result = await taskCollection.deleteOne(query)

            res.send(result)
        })



        // submission related apis

        // all submission by single worker, worker access
        app.get('/submissions/:email', varifyToken, verifyWorker, async (req, res) => {
            const email = req.params.email
            const query = { worker_email: email }
            const result = await submissionCollection.find(query).toArray()
            res.send(result)
        })

        // buyer tasks - submissions, buyer access
        app.get('/submission/:email', varifyToken, verifyBuyer, async (req, res) => {
            const email = req.params.email
            const query = { buyer_email: email }
            const result = await submissionCollection.find(query).toArray()
            res.send(result)
        })

        // worker posting submission, worker access
        app.post('/submissions', varifyToken, verifyWorker, async (req, res) => {
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

        // submission approve , buyer access
        app.patch('/submit/:id', varifyToken, verifyBuyer, async (req, res) => {
            const id = req.params.id

            const query = { _id: new ObjectId(id) }
            const updatedStatus = {
                $set: {
                    status: 'approved'
                }
            }
            const result = await submissionCollection.updateOne(query, updatedStatus)

            const submission = await submissionCollection.findOne(query)
            const workerQuery = { email: submission.worker_email }
            const updateUserCoin = {
                $inc: {
                    coin: + submission.payable_amount,
                }
            }

            const UserCoinRes = await userCollection.updateOne(workerQuery, updateUserCoin)

            res.send(result)
        })

        // submission reject, buyer access
        app.patch('/submitR/:id', varifyToken, verifyBuyer, async (req, res) => {
            const id = req.params.id

            const query = { _id: new ObjectId(id) }
            const updatedStatus = {
                $set: {
                    status: 'rejected'
                }
            }
            const result = await submissionCollection.updateOne(query, updatedStatus)

            const submission = await submissionCollection.findOne(query)
            const taskQuery = { _id: new ObjectId(submission.task_id) }

            const updateWorkerCount = {
                $inc: {
                    required_workers: +1, // Decrement required_workers by 1
                }
            }

            const taskRes = await taskCollection.updateOne(taskQuery, updateWorkerCount)

            res.send(result)
        })


        // withdeaw related apis

        app.get('/withdraws', varifyToken, async (req, res) => {
            const query = { status: 'pending' }
            const result = await withdrawCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/withdraw/:id', varifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }

            const updatedStatus = {
                $set: {
                    status: 'approved'
                }
            }

            const request = await withdrawCollection.findOne(query)

            const userQuery = { email: request.worker_email }
            const updateCoin = {
                $inc: {
                    coin: - request.withdrawal_coin
                }
            }
            const coinRes = await userCollection.updateOne(userQuery, updateCoin)

            const result = await withdrawCollection.updateOne(query, updatedStatus)

            res.send(result)

        })

        app.post('/withdraws', varifyToken, verifyWorker, async (req, res) => {
            const withdraw = req.body

            const result = await withdrawCollection.insertOne(withdraw)
            res.send(result)
        })

        // Payment related apis

        // packages
        app.get('/packages', varifyToken, verifyBuyer, async (req, res) => {
            const result = await packageCollection.find().toArray()
            res.send(result)
        })

        app.get('/package/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await packageCollection.findOne(query)
            res.send(result)
        })

        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body

            if (!price || isNaN(price)) {
                return res.status(400).send({ error: 'Invalid price provided' });
            }

            const paymentIntent = await stripe.paymentIntents.create({
                amount: parseInt(price),
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({ clientSecret: paymentIntent.client_secret })
        })

        app.post('/payments', varifyToken, verifyBuyer, async (req, res) => {
            const payment = req.body

            const query = { email: payment.email }
            const updatedCoin = {
                $inc: {
                    coin: + payment.coin
                }
            }
            const coinRes = await userCollection.updateOne(query, updatedCoin)

            const result = await paymentCollection.insertOne(payment)
            res.send(result)
        })

        app.get('/payments/:email', varifyToken, verifyBuyer, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })


        // notification related

        app.post('/notifications', varifyToken, async (req, res) => {
            const notification = req.body
            const result = await notificationCollection.insertOne(notification)
            res.send(result)
        })

        app.get('/notifacions/:email', varifyToken, async (req, res) => {
            const email = req.params.email
            const query = { ToEmail: email }
            const result = await notificationCollection.find(query).sort({ Time: -1 }).toArray()
            res.send(result)
        })



        // users related apis

        // admin access
        app.get('/users', varifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })

        // no token
        app.get('/topworkers', async (req, res) => {
            const query = { role: 'worker' }
            const result = await userCollection.find(query).sort({ coin: -1 }).limit(8).toArray()
            res.send(result)
        })
        // no token
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

        // admin changing user role
        app.patch('/users/:id', varifyToken, verifyAdmin, async (req, res) => {
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

        // admin deleting user
        app.delete('/users/:id', varifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })




        // stats api

        // admin stat
        app.get('/adminStats/:email', varifyToken, verifyAdmin, async (req, res) => {
            const buyerEmail = req.params.email;

            const workers = await userCollection.countDocuments({ role: 'worker' })
            const buyers = await userCollection.countDocuments({ role: 'buyer' })

            const coins = await userCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCoins: {
                            $sum: '$coin'
                        }
                    }
                }
            ]).toArray()

            const totalCoins = coins.length > 0 ? coins[0].totalCoins : 0;

            res.send({
                workers,
                buyers,
                totalCoins
            })
        })

        // buyer stat
        app.get('/buyerStats/:email', varifyToken, verifyBuyer, async (req, res) => {
            const buyerEmail = req.params.email;

            const tasks = await taskCollection.countDocuments({ buyer_email: buyerEmail })
            const payments = await paymentCollection.aggregate([
                {
                    $match: { email: buyerEmail } // Filter tasks by buyer_email
                },
                {
                    $group: {
                        _id: null,
                        totalPayments: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray()
            const totalPayments = payments.length > 0 ? payments[0].totalPayments : 0;


            const pendingTasks = await taskCollection.aggregate([
                {
                    $match: { buyer_email: buyerEmail } // Filter tasks by buyer_email
                },
                {
                    $group: {
                        _id: null,
                        totalPendingTasks: {
                            $sum: '$required_workers'
                        }
                    }
                }
            ]).toArray()
            const totalPendingTasks = pendingTasks.length > 0 ? pendingTasks[0].totalPendingTasks : 0;


            res.send({
                tasks,
                totalPendingTasks,
                totalPayments
            })
        })

        // workerStats
        app.get('/workerStats/:email', varifyToken, verifyWorker, async (req, res) => {
            const workerEmail = req.params.email;

            const submissions = await submissionCollection.countDocuments({ worker_email: workerEmail })
            const pendingSubmissions = await submissionCollection.countDocuments({ worker_email: workerEmail, status: 'pending' })
            // const payments = await paymentCollection.estimatedDocumentCount()

            const payAmount = await submissionCollection.aggregate([
                {
                    $match: { worker_email: workerEmail, status: 'approved' }
                },
                {
                    $group: {
                        _id: null,
                        totalPayAmount: {
                            $sum: '$payable_amount'
                        }
                    }
                }
            ]).toArray()

            const totalPayAmount = payAmount.length > 0 ? payAmount[0].totalPayAmount : 0;

            res.send({
                submissions,
                totalPayAmount,
                pendingSubmissions,
            })
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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