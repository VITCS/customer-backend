const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const axios = require("axios");

exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  console.log("Received event {}", JSON.stringify(event, 3));

  let response;

  
  try {
    
    const { field, shipmentId } = event.detail.input;
    // Retrive Ordershipment details
    const orderShipmentParams = {
      TableName: process.env.ORDER_SHIPMENT_TABLE,
      Key: {
        id: shipmentId,
      },
    };
    const orderShipment = await dynamodb.get(orderShipmentParams).promise();
    console.log("order shipment:: ", orderShipment.Item);

    //Retrive Order details
    const orderParams = {
      TableName: process.env.ORDER_TABLE,
      Key: {
        id: orderShipment.Item.orderId,
      },
    };
    const order = await dynamodb.get(orderParams).promise();
    console.log("order:: ", order.Item);


    //Retrive Customer Profile details
    const customerProfileParams = {
      TableName: process.env.CUSTOMER_PROFILE_TABLE,
      Key: {
        userId: orderShipment.Item.userId,
      },
    };
    const customerProfile = await dynamodb.get(customerProfileParams).promise();
    console.log("Customer Profile:: ", customerProfile.Item);

    switch (field) {

      case "createOrder":
        response = await createOrder(event.detail.input,orderShipment,order,customerProfile);
        break;
      case "refundOrder":
        response = await refundOrder(event.detail.input,orderShipment,order,customerProfile);
        break;
    }
  } catch (err) {
    console.log("ERROR Occured:: ", err);
  }
  return response;
};


const createOrder = async (body,orderShipment,order,customerProfile) => {
  try {
    const orderXMLStr = `
      <order>
        <api-version>1</api-version>
        <source>3</source>
        <alt-num>${orderShipment.Item.orderId}</alt-num>
        <orderred>${orderShipment.Item.createdAt}</orderred>
        <notes>Test Order from 1800 spirits</notes>
        <customer-email>${customerProfile.Item.email}</customer-email>
        <first-name>${customerProfile.Item.firstName}</first-name>
        <last-name>${customerProfile.Item.lastName}</last-name>
        <phone>${customerProfile.Item.phoneNumber}</phone>
        <delivery-time>${orderShipment.Item.createdAt}</delivery-time>
        <total-tax>${orderShipment.Item.subTotalTax}</total-tax>

        <billing-address>
          <address1>${orderShipment.Item.deliveryAddress.addrLine1}</address1>
          <address2>${orderShipment.Item.deliveryAddress.addrLine2}</address2>
          <city>${orderShipment.Item.deliveryAddress.city}</city>
          <state>${orderShipment.Item.deliveryAddress.state}</state>
          <zip-code>${orderShipment.Item.deliveryAddress.postCode}</zip-code>          
        </billing-address>

        <shipping-address>
          <shipping-first-name>${customerProfile.Item.firstName}</shipping-first-name>
          <shipping-last-name>${customerProfile.Item.lastName}</shipping-last-name>
          <address1>${orderShipment.Item.deliveryAddress.addrLine1}</address1>
          <city>${orderShipment.Item.deliveryAddress.city}</city>
          <state>${orderShipment.Item.deliveryAddress.state}</state>
          <zip-code>${orderShipment.Item.deliveryAddress.postCode}</zip-code>
          <shipping-phone>${customerProfile.Item.phoneNumber}</shipping-phone>          
        </shipping-address>

        <items>
          ${orderShipment.Item.orderLineItems.map((item) => {
            return `<item>
              <item-num>${item.storeItemId}</item-num>              
              <quantity>${item.qtyPurchased}</quantity>
              <price>${item.totalPrice}</price>                            
            </item>`;
          })}

          <item>
            <item-num>gratuity</item-num>
            <price>${orderShipment.Item.subTotalTipAmount}</price>          
          </item>

          <item>
            <item-num>shipping</item-num>
            <price>${orderShipment.Item.subTotalServiceCharge}</price>            
          </item>

        </items>

        <tenders>
          <tender>
            <amount>${orderShipment.Item.subTotalAmount}</amount>
            <tender-id>4</tender-id>
          </tender>
        </tenders>

      </order>
    `;

    console.log("Input:: ", orderXMLStr);

    const resVision = await axios.default.post(
      process.env.API_URL_ORDERS,
      orderXMLStr,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        auth: {
          username: "admin430678",
          password: "329d5d525c85045582fd1b8a1129fe27",
        },
      }
    );

    console.log("Response vision:: ", resVision);
  } catch (err) {
    console.log("ERROR:: ", err);
   }
};

const refundOrder = async (body,orderShipment,order,customerProfile) => {
  console.log("In refund order");
  try {
    // const { shipmentId } = body;

    // const orderShipmentParams = {
    //   TableName: process.env.ORDER_SHIPMENT_TABLE,
    //   Key: {
    //     id: shipmentId,
    //   },
    // };

    // const orderShipment = await dynamodb.get(orderShipmentParams).promise();

    const refundXMLStr = `
      <refund>

        <api-version>1</api-version>
        <order-alt-num>${orderShipment.Item.orderId}</order-alt-num>
        <alt-num>${orderShipment.Item.orderId}</alt-num>
        <notes>Test refund from 1800 spirits</notes>
        <source>3</source>
      
        <items>
          <item>
            <item-num>00812</item-num>
            <price>13.99</price>            
            <quantity>1</quantity>
          </item>
                
        ${orderShipment.Item.orderLineItems.map((item) => {
          return `<item>
            <item-num>${item.storeItemId}</item-num>              
            <quantity>${item.qtyPurchased}</quantity>
            <price>${item.totalPrice}</price>                            
          </item>`;
        })}
        </items>



      </refund>
    `;

    console.log("Input:: ", refundXMLStr);


    const resVision = await axios.default.post(
      // "https://br-family-jersey-city.vznlink.com/refunds",
      process.env.API_URL_REFUNDS,
      refundXMLStr,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        auth: {
          username: "admin430678",
          password: "329d5d525c85045582fd1b8a1129fe27",
        },
      }
    );

    console.log("Response vision:: ", resVision);
  } catch (err) {
    console.log("ERROR:: ", err);
  }
};
