const { promise } = require("bcrypt/promises");
let db = require("../config/db");
let collections = require("../config/db_collections");
let bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
let objectId = require("mongodb").ObjectId;
const Razorpay=require("razorpay");
const crypto=require('crypto')

//razorpay key
var instance = new Razorpay(
  { key_id: 'rzp_test_pxesEGDrhbZPaE',
   key_secret: 'AJNlFoCKb2pIORvIwl5ERT4J' })

module.exports = {
  sign_up: (user_data) => {
    return new Promise(async (resolve, reject) => {
      user_data.password = await bcrypt.hash(user_data.password, 10);
      db.get()
        .collection(collections.USERS)
        .insertOne(user_data)
        .then((data) => {
          resolve(data);
        });
    });
  },
  log_in: (user_data) => {
    return new Promise(async (resolve, recject) => {
      let login_status = false;
      let response = {};
      let user = await db
        .get()
        .collection(collections.USERS)
        .findOne({ email: user_data.email });
      if (!user) {
        response.login_status = false;
      } else {
        let passwordEcry = await bcrypt.compare(
          user_data.password,
          user.password
        );
        if (!passwordEcry) {
          response.login_status = false;
        } else {
          response.login_status = true;
          response.user = user;
        }
      }
      resolve(response);
    });
  },
  add_to_cart: (product_id, user_id) => {
    return new Promise(async (resolve, reject) => {
      let product_object_id = await new objectId(product_id);
      let user_object_id = await new objectId(user_id);
      let product_object = {
        item: product_object_id,
        quantity: 1,
      };

      let cart = await db
        .get()
        .collection(collections.CART)
        .findOne({ user: user_object_id });
      if (cart) {
        let product_exist = await cart.products.findIndex(
          (product) => product.item == product_id
        );
        if (product_exist != -1) {
          let quantity_update = await db
            .get()
            .collection(collections.CART)
            .updateOne(
              { user: user_object_id, "products.item": product_object_id },
              { $inc: { "products.$.quantity": 1 } }
            );
          resolve(quantity_update);
        } else {
          let push_new_product = await db
            .get() 
            .collection(collections.CART)
            .updateOne(
              { user: user_object_id },
              {
                $push: { products: product_object },
              }
            );
          resolve(push_new_product);
        }
      } else {
        let cart_obj = {
          user: user_object_id,
          products: [product_object],
        };
        let create_cart = await db
          .get()
          .collection(collections.CART)
          .insertOne(cart_obj);
        resolve(create_cart);
      }
    });
  },
  get_cart_products: (user_id) => {
    return new Promise(async (resolve) => {
      let user_id_object = await new ObjectId(user_id);
      let cart_items = await db
        .get()
        .collection(collections.CART)
        .aggregate([
          {
            $match: { user: user_id_object },
          },
          {
            $unwind: "$products",
          },
          {
            $project: {
              item: "$products.item",
              quantity: "$products.quantity",
            },
          },
          {
            $lookup: {
              from: collections.PRODUCT,
              localField: "item",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $project: {
              item: 1,
              quantity: 1,
              product: { $arrayElemAt: ["$product", 0] },
            },
          },
        ])
        .toArray();
      resolve(cart_items);
    });
  },

  cart_count: (user_id) => {
    return new Promise(async (resolve, reject) => {
      let user_object_id = await new objectId(user_id);
      let cart = await db
        .get()
        .collection(collections.CART)
        .findOne({ user: user_object_id });
      if (cart) {
        let count = await cart.products.length; 
        resolve(count);
      } else { 
        resolve(0);
      }
    });
  },
  change_product_quantity: async (details) => {
    details.quantity = parseInt(details.quantity);
    details.count = parseInt(details.count);
    let cart_object_id = await new objectId(details.cart);
    let product_object_id = await new objectId(details.product);

    return new Promise(async (resolve, reject) => {
      if (details.count == -1 && details.quantity == 1) {
        let remove_product = await db
          .get()
          .collection(collections.CART)
          .updateOne(
            { _id: cart_object_id },
            { $pull: { products: { item: product_object_id } } }//to delete elements in an array products
          );
        
        resolve({status:false,product_removed:true})
      } else {
        let quantity_update = await db
          .get()
          .collection(collections.CART)
          .updateOne(//to get element in array "products.item"
            { _id: cart_object_id, "products.item": product_object_id },
            { $inc: { "products.$.quantity": details.count } }
          );
        resolve({ status: true });
      }
    });
  },total_amount_of_each_order:async(order_id)=>{
    order_id= await new objectId(order_id);
    return new Promise(async(resolve,reject)=>{
      let order_details= await db.get().collection(collections.ORDERS).findOne({_id:order_id})
      resolve(order_details)
    })
  }
  ,
  total_amount: async(user_id) => {
    let user_id_object = await new objectId(user_id);
    return new Promise(async (resolve, reject) => {
    
      let total = await db
        .get()
        .collection(collections.CART)
        .aggregate([
          {
            $match: { user: user_id_object },
          },
          {
            $unwind: "$products",
          },
          {
            $project: {
              item: "$products.item",
              quantity: "$products.quantity",
            },
          },
          {
            $lookup: {
              from: collections.PRODUCT,
              localField: "item",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $project: {
              item: 1,
              quantity: 1,
              product: { $arrayElemAt: ["$product", 0] },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $multiply: ["$quantity", "$product.price"] } },
            },
          },
        ])
        .toArray();
        resolve(total[0])
    });
  },
  get_product_list:(user_id)=>{
   return new Promise(async(resolve,reject)=>{
    let user_object_id= await new objectId(user_id) 
    let product_list= await db.get().collection(collections.CART).findOne({user:user_object_id})
    resolve(product_list.products)
   })
  },
  place_order:(order_details,product_details,total_amount,condition)=>{
    return new Promise(async(resolve,reject)=>{
      let user_object_id= await new objectId(order_details.user_id)
      let status= order_details.payment_method==='COD'?'Placed':'Pending'
      order_object={
        user:user_object_id,
        products:product_details,
        total_amount:total_amount,
        payment_method:order_details.payment_method,
        status:status,
        date:new Date(),
        delivery_details:{
          address:order_details.address,
          pin_code:order_details.pincode,
          mobile_number:order_details.mobilenumber 
        }
      }
      let insert_order_data=await db.get().collection(collections.ORDERS).insertOne(order_object)
      if(condition==false){ 
      let clear_cart= await db.get().collection(collections.CART).deleteOne({user:user_object_id})}
      resolve(insert_order_data.insertedId)
    })
  },
  orders_of_user:(user_id)=>{
    return new Promise(async(resolve,reject)=>{
      let user_object_id= await new objectId(user_id) 
      let orders=db.get().collection(collections.ORDERS).find({user:user_object_id})
      .sort({date:-1}).toArray()
      resolve(orders)
    })
  },cancel_order:async(order_id)=>{
    order_id= await new objectId(order_id)
    return new Promise(async(resolve,reject)=>{
      let change_order_status= await db.get().collection(collections.ORDERS).
      updateOne({_id:order_id},{$set:{status:'Cancelled'}});
      resolve(change_order_status)
    })
  }
  ,
  ordered_products_list:(order_id)=>{
    return new Promise(async(resolve,reject)=>{
      let order_id_object = await new objectId(order_id)
      let products = await db
        .get()
        .collection(collections.ORDERS)
        .aggregate([
          {
            $match: {_id:order_id_object},
          },
          {
            $unwind: "$products",
          },
          {
            $project: {
              item: "$products.item",
              quantity: "$products.quantity",
            },
          },
          {
            $lookup: {
              from: collections.PRODUCT,
              localField: "item",
              foreignField: "_id",
              as: "product",
            },
          },
          {
            $project: {
              item: 1,
              quantity: 1,
              product: { $arrayElemAt: ["$product", 0] },
            },
          },
        ])
        .toArray();
      resolve(products);
      
    })
  },
  generate_razorpay:(order_id,total_amount)=>{
    return new Promise(async(resolve,reject)=>{
    var options = {
      amount: total_amount*100, 
      currency: "INR",
      receipt: ""+order_id
    };
    instance.orders.create(options, function(err, order) {
      if(err){
        //console.log('userhelpers:334',err);
      }else{
      resolve(order)
      }
      })
    })
  },
  payment_verification:(details)=>{
    return new Promise((resolve,reject)=>{
      let hmac=crypto.createHmac('sha256','AJNlFoCKb2pIORvIwl5ERT4J')
      hmac.update(details['payment[razorpay_order_id]']+'|'+details['payment[razorpay_payment_id]'])
      hmac.digest('hex')
      if(hmac==details['payment[razorpay_signature]']){
        resolve({status:true})
      }else{
        resolve({status:false})

      }
    })

  },
  change_payment_status:(order_id)=>{
    return new Promise(async(resolve,reject)=>{
      let order_id_object= await new objectId(order_id)
      let status= await db.get().collection(collections.ORDERS).updateOne(
        {_id:order_id_object},
        {$set:{status:'Placed'}}
        )
        resolve(true)
    })

  },
  remove_product:(cart_id)=>{
    return new Promise((resolve,reject)=>{
      let cart_obj_id= new objectId(cart_id)
      db.get().collection(collections.CART).aggregate([{$match:{_id:cart_obj_id}},
        {$project:{products:1}}]).toArray()
        .then((result)=>{
          resolve(result[0].products)
        })
    })
  },
  update_cart:(cart_id,new_products)=>{
    return new Promise(async(resolve,reject)=>{
      let cart_obj_id= new objectId(cart_id)
      db.get().collection(collections.CART).updateOne({_id:cart_obj_id},{$set:{products:new_products}})
      .then((result)=>{
        resolve(true);
      })
    })

  },
  get_product_details:(product_id)=>{
   return new Promise((resolve,reject)=>{
    product_id=new objectId(product_id)
    db.get().collection(collections.PRODUCT).findOne({_id:product_id}).then((response)=>{
      resolve(response)
    })
   })
  },
  get_amount_of_one_product:(product_id)=>{
    return new Promise((resolve,reject)=>{
      product_id= new objectId(product_id);
      db.get().collection(collections.PRODUCT).findOne({_id:product_id}).then((result)=>{
        resolve(result);
      })
    })

  },
  search:(prompt)=>{
    prompt=prompt.toString()
    return new Promise(async(resolve,reject)=>{
      let search_result= await db.get().collection(collections.PRODUCT).find({
        "$or":[{"name":{$regex:prompt, $options: 'i'}}]
      }).toArray()
      resolve(search_result)
    })
  },
  sort:async(prompt,sort_type)=>{
    prompt=await prompt.toString();
    sort_type=parseInt(sort_type);
    let sort_result=[]
    return new Promise(async(resolve,reject)=>{
      if(prompt==''){
        if(sort_type!=0){
           sort_result= await db.get().collection(collections.PRODUCT).find()
          .sort({price:sort_type}).toArray()
        }
        else{
           sort_result= await db.get().collection(collections.PRODUCT).find()
          .toArray()
        }
      }
      else{
        if(sort_type!=0){
          sort_result= await db.get().collection(collections.PRODUCT).find({
            "$or":[{"name":{$regex:prompt, $options: 'i'}}]
          }).sort({price:sort_type}).toArray()
        }
        else{
          sort_result= await db.get().collection(collections.PRODUCT).find({
            "$or":[{"name":{$regex:prompt, $options: 'i'}}]
          }).toArray()
        }
      }
      resolve(sort_result);
    })
  },
  verify_email:(email)=>{
    return new Promise(async(resolve,reject)=>{
      let verify_email=await db.get().collection(collections.USERS).findOne({email:email})
      resolve(verify_email);
    })
  },
  change_password:async(email,new_password)=>{
    new_password = await bcrypt.hash(new_password, 10);

    return new Promise(async(resolve,reject)=>{
      let change_password=await db.get().collection(collections.USERS).updateOne({email:email},
        {$set:{password:new_password}})
      resolve(change_password);
    })
  },
};