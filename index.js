const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { get } = require('express/lib/response');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 5000

// midleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fyfi4.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

console.log(uri);

async function run() {
    try {
        await client.connect();
        const partsCollection = client.db('carPats_plus').collection('parts');
        const categoryCollection = client.db('carPats_plus').collection('category');
        const makeCollection = client.db('carPats_plus').collection('make');
        const orderCollection = client.db('carPats_plus').collection('order');
        const reviewCollection = client.db('carPats_plus').collection('review');

        // get parts
        app.get('/parts', async (req, res) => {
            const parts = await partsCollection.find().toArray();
            res.send(parts);
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

        // send product info to purchase page
        app.get('/parts/:id', async (req, res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const parts = await partsCollection.findOne(query);
            res.send(parts);
        })

        // add order
        app.post('/order', async(req, res) =>{
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        })

        //get order
        app.get('/order', async (req, res) => {
            const order = await orderCollection.find().toArray();
            res.send(order);
        })

        // get specific user orders by email
        app.get('/order/:email', async(req, res) => {
            const email = req.params.email;
            const query = {email: email}
            const order = await orderCollection.find(query).toArray()
            res.send(order)
        })

        

        // Add review
        app.post('/review', async(req, res) =>{
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