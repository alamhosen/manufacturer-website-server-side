const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { get } = require('express/lib/response');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express()
const port = process.env.PORT || 5000

// midleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fyfi4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyjwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

console.log(uri);

async function run() {
    try {
        await client.connect();
        const partsCollection = client.db('carPats_plus').collection('parts');
        const categoryCollection = client.db('carPats_plus').collection('category');
        const makeCollection = client.db('carPats_plus').collection('make');
        const orderCollection = client.db('carPats_plus').collection('order');
        const reviewCollection = client.db('carPats_plus').collection('review');
        const profileCollection = client.db('carPats_plus').collection('profile');
        const userCollection = client.db('carPats_plus').collection('user');
        const paymentCollection = client.db('carPats_plus').collection('payments');

        // get parts
        app.get('/parts', async (req, res) => {
            const parts = await partsCollection.find().toArray();
            res.send(parts);
        })

        // add parts
        app.post('/parts', async (req, res) => {
            const parts = req.body;
            const result = await partsCollection.insertOne(parts);
            res.send(result);

        })

        // delete parts
        app.delete('/parts/:id', verifyjwt, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await partsCollection.deleteOne(filter);
            res.send(result);
        })

        // get category
        app.get('/category', async (req, res) => {
            const category = await categoryCollection.find().toArray();
            res.send(category);
        })

        // get parts make
        app.get('/make', async (req, res) => {
            const make = await makeCollection.find().toArray();
            res.send(make);
        })

        //get user
        app.get('/user', verifyjwt, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        // put users
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)

            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });

            res.send({ result, token });
        })

        // check isUser
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isUser = user.role !== 'admin';
            res.send({ normalUser: isUser })
        })

        // check isAdmin
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        // make user admin
        app.put('/user/admin/:email', verifyjwt, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

        })

        // send product info to purchase page
        app.get('/parts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const parts = await partsCollection.findOne(query);
            res.send(parts);
        })

        // payment 
        app.post('/create-payment-intent', verifyjwt, async (req, res) => {
            const parts = req.body;
            const price = parts.totalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });



        // put user profile info
        app.put('/profile/:email', async (req, res) => {
            const email = req.params.email;
            const profile = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: profile,
            };
            const result = await profileCollection.updateOne(filter, updateDoc, options)

            res.send(result);
        })

        // get user profile info
        app.get('/profile/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const profile = await profileCollection.find(query).toArray()
            res.send(profile);
        })

        // add order
        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        })


        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updateDoc)
            res.send(updateDoc);
        })

        // get all order for admin
        app.get('/order/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';

            if (isAdmin) {
                const order = await orderCollection.find().toArray()
                res.send(order)
            }

        })

        // get specific user orders by email
        app.get('/order', verifyjwt, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const order = await orderCollection.find(query).toArray()
            return res.send(order)
        })

        // get specific order by id
        app.get('/order/:id', verifyjwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        })

        // delete order
        app.delete('/order/:id', verifyjwt, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(filter);
            res.send(result);
        })

        // get review 
        app.get('/review', async (req, res) => {
            const review = await reviewCollection.find().toArray();
            res.send(review)
        })


        // Add review
        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);

        })

    }
    finally {

    }

}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from CarParts Plus!')
})

app.listen(port, () => {
    console.log(`CarParts app listening on port ${port}`)
})