const express = require("express");
const cors = require("cors");
// required JWT PART
const jwt = require("jsonwebtoken");
// required cookie parser
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser())

// connect mongodb
// process.env.DB_PASSWORD || process.env.DB_USER
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.7cekihd.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Again Middlewares used for set the cookie part
const logger = (req, res, next) =>{
  console.log('log: info', req.method, req.url);
  next()
}

const verifiedToken = (req, res, next) =>{
  const token = req?.cookies?.token
  // console.log('token in the middleware:', token);
  // no token available behaviour
if (!token) {
  return res.status(401).send({message : 'unauthorized access'})
}
// token available
jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) =>{
  if (err) {
    return res.status(401).send({message : 'unauthorized access'})
  }
  req.user = decoded
  next()

})
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const carServicesCollection = client.db("car").collection("services");
    // booking collection
    const bookingCollection = client.db("car").collection("bookings");

    // fetch services items in home page
    app.get("/services", async (req, res) => {
      const cursor = carServicesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await carServicesCollection.findOne(query, options);
      res.send(result);
    });

    // booking
    app.get("/bookings", logger, verifiedToken, async (req, res) => {
      console.log(req.query.email);
      console.log('token owner info:', req.user);
      if (req.user.email !== req.query.email) {
        return res.status(403).send({message : 'forbidden access'})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find().toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      // console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;
      console.log(updatedBooking);
      const updateDoc = {
        $set: {
          status: updatedBooking.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // JWT section workout/ auth related
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post('/logout', async(req, res) => {
      const user =req.body
      console.log('logout user', user);
      res.clearCookie('token', {maxAge: 0}).send({success: true})
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("cars doctor server is running");
});

app.listen(port, () => {
  console.log(`cars doctor server is running on port ${port} `);
});
