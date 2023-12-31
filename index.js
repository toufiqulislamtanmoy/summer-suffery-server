const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_TOKEN);
const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.SECRECT_TOKEN, (err, decoded) => {

    if (err) {
      return res.status(401).send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  })
}

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
    client.connect();
    const usersCollections = client.db("summer-suffery").collection("users");
    const classessCollections = client.db("summer-suffery").collection("classess");
    const selectedClassCollections = client.db("summer-suffery").collection("selectedClass");
    const paymentsCollections = client.db("summer-suffery").collection("payments");
    const feedbackCollections = client.db("summer-suffery").collection("feedback");
    /**********Generate JWT token*********/

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRECT_TOKEN, { expiresIn: "1h" });
      res.send({ token });
    })

    // Check the user is admin or not
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollections.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    // Check the user is instructor or not
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollections.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

    // Verify admin midleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const result = await usersCollections.findOne(query);
      if (result?.role !== 'admin') {
        return res.status(401).send({ error: true, message: "forbidden access" });
      }
      next();
    }
    // Verify instructor midleware
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const result = await usersCollections.findOne(query);
      if (result?.role !== 'instructor') {
        return res.status(401).send({ error: true, message: "forbidden access" });
      }
      next();
    }

    app.get("/role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      const options = {
        projection: { role: 1 }
      };
      
      const result = await usersCollections.findOne(query, options);
      // if(result !== null){
      //   const { role } = result; // Extract the role field
      //   res.send({ role });
      // }else{
      //   res.send({})
      // }
      res.send(result);

    });



    /*********************  This all are the user api  start***************/
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollections.find().toArray();
      res.send(result);
    })
    app.get("/instructor", async (req, res) => {
      const result = await usersCollections.find({ role: "instructor" }).toArray();
      res.send(result);
    })



    // single user email query for checking user role
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await usersCollections.findOne(query);
      res.send(result);
    })

    // create user
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

    /*********************  This all are the user api  end***************/

    /*********************  This all are the class api  start***************/

    app.get("/classes", async (req, res) => {
      const result = await classessCollections.find().toArray();
      res.send(result);
    })
    //add new classes post api call
    app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {
      const classDetails = req.body;
      const result = await classessCollections.insertOne(classDetails);
      res.send(result);
    })



    // approve class api call
    app.patch("/classes/approve/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approve"
        },
      };
      const result = await classessCollections.updateOne(query, updateDoc);
      res.send(result);
    })
    // deny class api call
    app.patch("/classes/deny/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "deny"
        },
      };
      const result = await classessCollections.updateOne(query, updateDoc);
      res.send(result);
    })
    // feedback class api call
    app.patch("/classes/feedback/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback
        },
      };
      const result = await classessCollections.updateOne(query, updateDoc);
      res.send(result);
    })

    // sort by popular class 
    app.get("/popularClass", async (req, res) => {
      const options = {
        sort: { enrollStudent: -1 }
      };
      const result = await classessCollections.find({}, options).toArray();
      res.send(result)
    })

    /*** 
     * popular instructor based on the enroll student  
     * use aggregate to find the overall enroll number
     * then find the instructor infromation based on the email in the class collection
     * ****/

    app.get("/popularInstructor", async (req, res) => {
      const result = await classessCollections.aggregate([
        {
          $group: {
            _id: {
              instructor: "$instructor",
              email: "$instructorEmail"
            },
            totalEnrollments: { $sum: "$enrollStudent" }
          }
        },
        {
          $sort: { totalEnrollments: -1 }
        }
      ]).toArray();

      const formattedResult = [];

      for (const { _id, totalEnrollments } of result) {
        const { email } = _id;
        const query = { email: email };
        const instructorDetails = await usersCollections.findOne(query);

        if (instructorDetails) {
          formattedResult.push({
            totalEnrollments,
            instructorDetails
          });
        }

      }
      res.send(formattedResult);
    })

    // get class details by instructor email
    app.get("/classes/instructor/:email", verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const result = await classessCollections.find(query).toArray();
      res.send(result);
    });



    /*********************  This selected classes api  start***************/

    app.get("/selectedClass/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) }
      const result = await selectedClassCollections.findOne(quary);
      res.send(result);

    })
    // get selected class by email 
    app.get('/selectedClass', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await selectedClassCollections.find(query).toArray();
      res.send(result);
    })
    // add selected class 
    app.post('/selectedClass', async (req, res) => {
      const course = req.body;
      const result = await selectedClassCollections.insertOne(course);
      res.send(result);
    })
    // Delete Selected Items
    app.delete('/selectedClass/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await selectedClassCollections.deleteOne(query);
      res.send(result);
    })
    /*********************  This selected classes api  end***************/


    /*********************  make admin ***************/

    app.patch('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin"
        },
      };
      const result = await usersCollections.updateOne(filter, updateDoc);
      res.send(result);
    })
    /*********************  make instructor ***************/

    app.patch('/users/instructor/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor"
        },
      };
      const result = await usersCollections.updateOne(filter, updateDoc);
      res.send(result);
    })
    /*********************  This all are the user api  end***************/

    /*********Payment INtent api call*********/

    // payment getway api
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // payment info data post api

    app.post('/payments', verifyJWT, async (req, res) => {
      const paymentInfo = req.body;
      const insertResult = await paymentsCollections.insertOne(paymentInfo);
      const updateResult = await classessCollections.updateOne(
        { _id: new ObjectId(paymentInfo.classId) },
        { $inc: { seats: -1, enrollStudent: 1 } }
      );

      const deleteResult = await selectedClassCollections.deleteOne(
        { _id: new ObjectId(paymentInfo.selectedClassID) } // Specify the filter criteria
      );

      res.send({ insertResult, updateResult, deleteResult });
    })


    /********** Enrol CLasses Get api call***********/

    app.get("/enrollClass/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.send({ message: "unauthorized" });
      }
      const query = { email: email }
      const result = await paymentsCollections.find(query).toArray();
      res.send(result);

    })

    // payment history api call
    app.get("/paymentHistory/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.send({ message: "unauthorized" });
        return;
      }

      const query = { email: email };

      const options = {
        sort: { date: -1 },
        // Include only the `title` and `imdb` fields in each returned document
        projection: { date: 1, className: 1, transactionId: 1, price: 1},
      };


      // const projection = { date: 1, className: 1, transactionId: 1, price: 1 };
      const result = await paymentsCollections.find(query,options).toArray();
      res.send(result);
    });

    // user feedback

    app.get("/feedback", async (req, res) => {
      const result = await feedbackCollections.find().toArray();
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("adfmin").command({ ping: 1 });
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