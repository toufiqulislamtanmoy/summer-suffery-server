const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Class Is Enrolling")
})

// mongodb 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zvd8xno.mongodb.net/?retryWrites=true&w=majority`;

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
    await client.connect();
    const usersCollections = client.db("summer-suffery").collection("users");
    const classessCollections = client.db("summer-suffery").collection("classess");
// This all are the user api
    app.get("/users", async(req,res)=>{
      const result = await usersCollections.find().toArray();
      res.send(result);
    } )
    // single user email query
    app.get("/users/:email", async(req,res)=>{
      const email = req.params.email;
      const query = {email: email}
      const result = await usersCollections.findOne(query);
      res.send(result);
    } )

    app.post("/users", async (req, res) => {
      const userDetails = req.body;
      const query = { email: userDetails.email };
      const existingUser = await usersCollections.findOne(query);
      if (existingUser) {
        return res.send({ message: "User Already Exist" });
      }
      const result = await usersCollections.insertOne(userDetails);
      res.send(result);
    })

    // This all are the classes api

    app.get("/classes", async (req,res)=>{
      const result = await classessCollections.find().toArray();
      res.send(result);
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})