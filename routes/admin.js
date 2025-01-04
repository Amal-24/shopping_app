var express = require("express");
var router = express.Router();
var productHelpers = require("../helpers/productHelpers");
let fs=require("fs-extra")

/* GET users listing. */
router.get("/", function (req, res, next) {

  productHelpers.viewProduct().then((products)=>{
    res.render("admin/admin_home", { admin: true, products});

  })
  
});

router.get("/add_product", function (req, res, next) {
  res.render("admin/add_product", { admin: true });
});

router.post("/add_product", function (req, res, next) {
 
  req.body.Price=parseInt(req.body.Price)
  productHelpers.addProduct(req.body, (id) => {
    

    let image = req.files.Image;
    image.mv("./public/product_images/" + id + ".jpg", (err, done) => {
      if (!err) {
        res.redirect('/admin')
      } else {
        res.send(err);
      }
    });
  });
});





router.get('/delete_product',(req,res)=>{
  let product_id=req.query.id
  productHelpers.delete_product(product_id).then((resp)=>{
    res.redirect('/admin')

  })
  

})




router.get('/edit_product',async(req,res)=>{
  let product_id=req.query.id
  let product= await productHelpers.getProductDetails(product_id)
  res.render('admin/edit_product',{admin:true,product})}
);

router.post('/edit_product',async(req,res)=>{
  let product_id=req.query.id
  console.log('a61',product_id)
  req.body.Price=parseInt(req.body.Price)
  if(req.body.Condition=='true'){
    let delete_image=await fs.unlinkSync("../public/product_images/"+product_id+".jpg")
    console.log('a66',delete_image)
   let image = req.files.Image;
   let replaced_image=await image.mv("../public/product_images/" + product_id + ".jpg")
  }
  let updateResult= await productHelpers.updateProduct(product_id,req.body)
  res.redirect('/admin')
})

router.get('/all_orders',(req,res)=>{
  res.send('all orders')
})




module.exports = router;
