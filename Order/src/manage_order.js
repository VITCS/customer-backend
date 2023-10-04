const AWS = require("aws-sdk");
const eventbridge = new AWS.EventBridge({ apiVersion: "2015-10-07" });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();
const { customAlphabet } = require("nanoid");
const alphabet = "0123456789";
const idSize = 16;
const nanoid = customAlphabet(alphabet, idSize);
const libphonenumber = require("libphonenumber-js");
const axios = require("axios");
const taxjar = require("taxjar");
let keyParameterstripeKeys;
let keystripeKeys;
let stripePublishableKey;
let keystripePublishableKey;
const stripeKeys = {
  Name: "/spirits/stripeKeys/STRIPE_SECRET_KEY",
  WithDecryption: true,
};

const stripePublishableKeyParams = {
  Name: "/spirits/stripeKeys/STRIPE_PUBLISHABLE_KEY",
  WithDecryption: true,
};

// keyParameterstripeKeys = ssm
//   .getParameter(stripeKeys)
//   .promise()
//   .then((response) => response.$response.data);
// console.log(keyParameterstripeKeys)
// keystripeKeys = keyParameterstripeKeys.Parameter.Value;

// (async () => {
//   console.log('in iife');
//   keyParameterstripeKeys = await ssm.getParameter(stripeKeys).promise();
//   console.log('Res:: ', keyParameterstripeKeys);
//   // stripePublishableKey = await ssm.getParameter(stripePublishableKeyParams).promise();
//   // console.log('Res1:: ', keyParameterstripeKeys, stripePublishableKey);
//   // keystripeKeys = keyParameterstripeKeys.Parameter.Value;
//   // keystripePublishableKey = stripePublishableKey.Parameter.Value;
//   // console.log('Res2:: ', keystripeKeys, keystripePublishableKey);
// })();

// console.log(keystripeKeys, keystripePublishableKey);

// stripePublishableKey = ssm
//   .getParameter(stripePublishableKeyParams)
//   .promise()
//   .then((response) => response.$response.data);

// keystripePublishableKey = stripePublishableKey.Parameter.Value;

// const stripe = require("stripe")(keystripeKeys);
// const STRIPE_PUBLISHABLE_KEY = keystripePublishableKey;

let stripe;
let STRIPE_PUBLISHABLE_KEY;

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    keyParameterstripeKeys = await ssm.getParameter(stripeKeys).promise();
    stripePublishableKey = await ssm
      .getParameter(stripePublishableKeyParams)
      .promise();
    keystripeKeys = keyParameterstripeKeys.Parameter.Value;
    keystripePublishableKey = stripePublishableKey.Parameter.Value;

    stripe = require("stripe")(keystripeKeys);
    STRIPE_PUBLISHABLE_KEY = keystripePublishableKey;

    switch (event.field) {
      case "createOrder":
        response = await createOrder(event.body);
        break;
      case "updateOrder":
        response = await updateOrder(event.body);
        break;
      case "deleteOrder":
        response = await deleteOrder(event.body);
        break;
      case "calculateTax":
        response = calculateTax(event.body);
        break;
      case "createPaymentIntent":
        response = createPaymentIntent(event.body);
        break;
      case "capturePayment":
        response = capturePayment(event.body);
        break;
      case "paymentMethodsList":
        response = paymentMethodsList(event.body);
        break;
      case "deletePaymentMethod":
        response = deletePaymentMethod(event.body);
        break;
      case "defaultPaymentMethod":
        response = defaultPaymentMethod(event.body);
        break;
      case "saveCustomerCard":
        response = saveCustomerCard(event.body);
        break;
    }
  } catch (e) {
    console.error("Error Occured", e);
  }
  return response;
};
const setAsyncTimeout = (cb, timeout = 0) =>
  new Promise((resolve, reject) => {
    resolve(cb);
    setAsyncTimeout(
      () => reject("Request is taking too long to response"),
      timeout
    );
  });
/**************************************************************
 * Create Customer User
 **************************************************************/

createOrder = async (body) => {
  const id = nanoid();
  body.input["id"] = id;
  body.input["createdAt"] = new Date().toISOString();
  body.input["updatedAt"] = new Date().toISOString();
  let newBody;
  let returnBody =
    body?.input?.orderShipment?.length > 0
      ? JSON.parse(JSON.stringify(body.input.orderShipment))
      : [];
  let totalAmnt = 0;

  console.log("Order shipment length:: ", body.input.orderShipment);

  if (body.input.orderShipment && body.input.orderShipment.length > 0) {
    newBody = { ...body.input };
    delete body.input.orderShipment;
    const orderShipmentParams = {
      TableName: process.env.ORDER_SHIPMENT_TABLE,
    };
    for (const item of newBody.orderShipment) {
      const newId = nanoid();
      item["id"] = newId;
      item["orderId"] = id;
      item["createdAt"] = new Date().toISOString();
      item["updatedAt"] = new Date().toISOString();
      item["subTotalServiceCharge"] = 4.49; // Service Charge
      item["isUpdated"] = false;

      let total = 0;

      if (item.orderLineItems && item.orderLineItems.length > 0) {
        for (const i of item.orderLineItems) {
          total += i.unitPrice * i.qtyPurchased;
        }

        item["subTotalProductAmount"] = total;
      }

      item["driversTip"] = parseInt(0.1 * item.subTotalProductAmount, 10); // Drivers tip

      // if (item.orderLineItems && item.orderLineItems.length > 0) {
      //   for (const i of item.orderLineItems) {
      //     const lineItemId = nanoid();
      //     i["id"] = lineItemId;
      //     totalAmnt += i.unitPrice * i.qtyPurchased;

      //     const query = {
      //       bool: {
      //         must: {
      //           match_all: {},
      //         },
      //       },
      //     };

      //     const newItem = await axios({
      //       method: "GET",
      //       url: `https://search-spirits-sit-es-4zcsptd7pfb2okhrb6pdjmcu3e.us-east-1.es.amazonaws.com/spirits-sit-priceandavailability/_doc/${item.assignedStoreId}:${i.productId}`,
      //       headers: {
      //         "Content-Type": "application/json",
      //       },
      //       data: JSON.stringify(query),
      //     });

      //     const itemQtyPresent = newItem._source.availableQty;

      //     const updateItemQuery = {
      //       doc: {
      //         availableQty: itemQtyPresent - i.qtyPurchased,
      //       },
      //     };

      //     const updateItem = await axios({
      //       method: "POST",
      //       url: `https://search-spirits-sit-es-4zcsptd7pfb2okhrb6pdjmcu3e.us-east-1.es.amazonaws.com/spirits-sit-priceandavailability/_doc/${item.assignedStoreId}:${i.productId}`,
      //       headers: {
      //         "Content-Type": "application/json",
      //       },
      //       data: JSON.stringify(updateItemQuery),
      //     });

      //     console.log("Updated item:: ", updateItem);
      //   }
      // }

      console.log("Item:: ", item);
      orderShipmentParams["Item"] = item;

      const orderShipmentInsertRes = await dynamodb
        .put(orderShipmentParams)
        .promise();
      console.log("Order shipment insert:: ", orderShipmentInsertRes);
      console.log("Item:: ", item);
      const paramsEventBridgeSubscription = {
        Entries: [
          /* required */
          {
            Detail: JSON.stringify({
              input: {
                id: newId,
                orderId: id,
                assignedStoreId: item.assignedStoreId,
                assignedStoreName: item.assignedStoreName,
                shipmentStatus: item.shipmentStatus,
                deliveryType: item.deliveryType,
                createdAt: item.createdAt,
                subTotalProductAmount: item.subTotalProductAmount,
              },
            }),
            DetailType: "transaction",
            // DetailType: "Order Status Update",
            // EventBusName: "create-order",
            EventBusName: process.env.PRD_EVENT_BUS_NAME.includes("prd")
              ? process.env.PRD_EVENT_BUS_NAME
              : "create-order",
            Source: process.env.PRD_EVENT_BUS_SOURCE.includes("prd")
              ? process.env.PRD_EVENT_BUS_SOURCE
              : process.env.TABLE_NAME,
          },
        ],
      };
      
      const visionWinePOSEntries = {
        Entries: [
          /* required */
          {
            Detail: JSON.stringify({
              input: {
                shipmentId: newId,
                field: 'createOrder'
              },
            }),
            DetailType: "transaction",
            // DetailType: "Order Status Update",
            // EventBusName: "create-order",
            EventBusName: 'spirits-sit-createOrder',
            // modfied to send an event for vision link -- Guru
            Source: 'spirits-sit-ManageOrder-Function'
            // Resources: [
            //     "arn:aws:events:us-east-1:843219620739:rule/spirits-sit-createOrder/spirits-sit-customer-VisionWinePOS-WinePOSRule-55JP6FSJ8EUK"
            //   ]
          },
        ],
      };

      const resultSubscription = await eventbridge
        .putEvents(paramsEventBridgeSubscription)
        .promise();
      console.log("resultSubscription order result:: ", resultSubscription);

      const visionresultSubscription = await eventbridge
      .putEvents(visionWinePOSEntries)
      .promise();
      console.log("visionWinePOSEntries order result:: ", visionWinePOSEntries);


      
      // const resultWinePOS = await eventbridge
      //   .putEvents(visionWinePOSEntries)
      //   .promise();
      // console.log("resultWinePOS order result:: ", resultWinePOS);
    }
  }
  // const paymentIntent = await stripe.paymentIntents.create({
  //   //amount: calculateOrderAmount(items),
  //   amount: totalAmnt,
  //   currency: "USD",
  //   capture_method: "manual",
  //   transfer_data: {
  //     destination: "acct_1KrERsQMEFziWAan",
  //   },
  // });
  // res.send({
  //   publicKey: env.parsed.STRIPE_PUBLISHABLE_KEY,
  //   clientSecret: paymentIntent.client_secret,
  //   id: paymentIntent.id
  // });
  const params = {
    TableName: process.env.TABLE_NAME,
    Item: {
      ...body.input,
      totalAmount: totalAmnt,
      // paymentIntent: paymentIntent.id,
    },
  };
  console.log("Return body :: ", returnBody);

  const resOrder = await dynamodb.put(params).promise();
  console.log(
    "Order response ::",
    JSON.stringify(resOrder),
    JSON.stringify(body)
  );

  // Publish Order Event
  await publishOrderEvent({ input: newBody }, "Order-Create");

  return {
    ...body.input,
    orderShipment: { items: newBody ? [...newBody.orderShipment] : null },
    message: "Item successfully Inserted",
  };
};

/**************************************************************
 * Update Customer User
 **************************************************************/
updateOrder = async (body) => {
  console.log(body);

  const { id } = body.input;

  let newBody;

  newBody = { ...body.input };

  delete newBody.id;
  delete newBody.orderShipment;

  let TestUpdateExpression = "";
  let ExpressionAttributeValues = {};
  let i = 0;

  if (JSON.stringify(newBody) === "{}") {
    TestUpdateExpression += `set updatedAt = :newUpdatedAt`;
    ExpressionAttributeValues[":newUpdatedAt"] = new Date().toISOString();
  } else {
    for (let item in newBody) {
      if (i === 0) {
        TestUpdateExpression += `set ${item} = :new${item}, `;
        i++;
      } else TestUpdateExpression += `${item} = :new${item}, `;

      ExpressionAttributeValues[`:new${item}`] = newBody[item];
    }
    TestUpdateExpression += "updatedAt = :newUpdatedAt";
    ExpressionAttributeValues[":newUpdatedAt"] = new Date().toISOString();
  }

  let UpdateExpression = TestUpdateExpression;

  console.log(UpdateExpression, ExpressionAttributeValues);

  let totalAmnt = 0;

  if (body.input.orderShipment) {
    for (const item of body.input.orderShipment) {
      switch (item.actionType) {
        case "delete":
          const { id } = item;

          const deleteParams = {
            TableName: process.env.ORDER_SHIPMENT_TABLE,
            Key: {
              id,
            },
          };

          try {
            // await setAsyncTimeout(
            //   dynamodb.delete(deleteParams).promise(),
            //   5000
            // );
            await dynamodb.delete(deleteParams).promise(),
              console.log("Deleted");
          } catch (err) {
            console.log(err);
          }
        case "add":
          const newId = nanoid();

          const addParams = {
            TableName: process.env.ORDER_SHIPMENT_TABLE,
            Item: { id: newId, ...item },
          };

          try {
            // await setAsyncTimeout(dynamodb.put(addParams).promise(), 5000);
            await dynamodb.put(addParams).promise();
            console.log("Added");
          } catch (err) {
            console.log(err);
          }
        case "update":
          const itemId = item.id;

          const newBody = { ...item };
          delete newBody.id;

          let TestUpdateExpression = "";
          let ExpressionAttributeValues = {};
          let i = 0;

          for (let item in newBody) {
            if (i === 0) {
              TestUpdateExpression += `set ${item} = :new${item}, `;
              i++;
            } else TestUpdateExpression += `${item} = :new${item}, `;

            ExpressionAttributeValues[`:new${item}`] = newBody[item];
          }

          TestUpdateExpression += "updatedAt = :newUpdatedAt";
          ExpressionAttributeValues[":newUpdatedAt"] =
            new Date().toLocaleString();

          const UpdateExpression = TestUpdateExpression;

          const updateParams = {
            TableName: process.env.ORDER_SHIPMENT_TABLE,
            Key: {
              id: itemId,
            },
            UpdateExpression,
            ExpressionAttributeValues,
            ReturnValues: "UPDATED_NEW",
          };

          try {
            // await setAsyncTimeout(
            //   dynamodb.update(updateParams).promise(),
            //   5000
            // );
            await dynamodb.update(updateParams).promise();
            console.log("Updated");
          } catch (err) {
            console.log(err);
          }
      }
    }
  }

  // UpdateExpression = `${UpdateExpression}, totalAmount = :newTotalAmount`;
  // ExpressionAttributeValues[":newTotalAmount"] = totalAmnt;

  const params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      id,
    },
    UpdateExpression,
    ExpressionAttributeValues,
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const res = await dynamodb.update(params).promise();
    console.log(res);
    return {
      id,
      ...res.Attributes,
      orderShipment: {
        items: [...body.input.orderShipment],
      },
    };
  } catch (err) {
    console.log("ERROR: ", err);
  }
};

/**************************************************************
 * Delete Customer User
 **************************************************************/
deleteOrder = async (body) => {
  try {
    console.log(body);

    const params = {
      TableName: process.env.TABLE_NAME,
      Key: {
        id: body.input.id,
      },
    };

    try {
      await setAsyncTimeout(dynamodb.delete(params).promise(), 5000);
      return {
        ...body.input,
        message: "Item successfully deleted",
      };
    } catch (err) {
      console.log("ERROR: ", err);
      throw err;
    }
  } catch (err) {
    console.error("Error Occured", e);
  }
};

/**************************************************************
 *  Publish Order Event
 **************************************************************/
publishOrderEvent = async (order, eventType) => {
  // Publish Order Event
  const orderEventParms = {
    Entries: [
      {
        Detail: JSON.stringify(order),
        DetailType: eventType,
        EventBusName: process.env.EVENT_BUS_NAME,
        Source: process.env.TABLE_NAME,
      },
    ],
  };

  const publishResult = await eventbridge.putEvents(orderEventParms).promise();
  console.log("Publish Order Result: ", publishResult);
  // Publish Completed
};

calculateTax = async (body) => {
  try {
    const keyParamstaxjarClient = {
      Name: "/spirits/taxjarClient/apiKey",
      WithDecryption: true,
    };

    const keyParametertaxjarID = await ssm
      .getParameter(keyParamstaxjarClient)
      .promise();
    const taxjarClient = new taxjar({
      apiKey: keyParametertaxjarID.Parameter.Value,
    });

    for (const item of body.input) {
      const taxjarObj = {
        // from_country: item?.storeAddress?.country,
        from_country: "US",
        from_zip: item?.storeAddress?.postCode,
        from_state: item?.storeAddress?.state,
        // to_country: item?.deliveryAddress?.country,
        to_country: "US",
        to_zip: item?.deliveryAddress?.postCode,
        to_state: item?.deliveryAddress?.state,
        amount: item?.subTotalProductAmount,
        shipping: 1.5,
        line_items: item?.orderLineItems?.map((lineItem) => {
          return {
            quantity: lineItem?.qtyPurchased,
            unit_price: lineItem?.unitPrice,
            // product_tax_code: 31000, // Add the code based on category
            product_tax_code:
              lineItem?.prodCategory === "Beer"
                ? "50202201A0000"
                : lineItem?.prodCategory === "Wine"
                ? "50202203A0000"
                : "50202206A0000",
          };
        }),
      };

      const resTax = await taxjarClient.taxForOrder(taxjarObj);

      console.log("Res tax:: ", resTax);

      for (const item of resTax.tax.breakdown.line_items)
        console.log("Item:: ", item);

      item["calculatedTax"] = resTax?.tax?.amount_to_collect;
    }

    return { items: body.input };
  } catch (err) {
    console.log("ERROR:: ", err);
  }
};

createPaymentIntent = async (body) => {
  const { paymentMethodType, currency, totalAmount, userId } = body.input;
  console.log(" body :: ", body);
  // Each payment method type has support for different currencies. In order to
  // support many payment method types and several currencies, this server
  // endpoint accepts both the payment method type and the currency as
  // parameters.
  //
  // Some example payment method types include `card`, `ideal`, and `alipay`.

  // If this is for an ACSS payment, we add payment_method_options to create
  // the Mandate.
  // if (paymentMethodType === "acss_debit") {
  //   params.payment_method_options = {
  //     acss_debit: {
  //       mandate_options: {
  //         payment_schedule: "sporadic",
  //         transaction_type: "personal",
  //       },
  //     },
  //   };
  // } else if (paymentMethodType === "konbini") {
  //   /**
  //    * Default value of the payment_method_options
  //    */
  //   params.payment_method_options = {
  //     konbini: {
  //       product_description: "Tシャツ",
  //       expires_after_days: 3,
  //     },
  //   };
  // } else if (paymentMethodType === "customer_balance") {
  //   params.payment_method_data = {
  //     type: "customer_balance",
  //   };
  //   params.confirm = true;
  //   params.customer =
  //     customerId || (await stripe.customers.create().then((data) => data.id));
  // }

  /**
   * If API given this data, we can overwride it
   */
  // if (paymentMethodOptions) {
  //   params.payment_method_options = paymentMethodOptions
  // }

  // Create a PaymentIntent with the amount, currency, and a payment method type.
  //
  // See the documentation [0] for the full list of supported parameters.
  //
  // [0] https://stripe.com/docs/api/payment_intents/create
  try {
    let customer;
    let paymentIntent;
    const paramsGetCustomer = {
      TableName: process.env.CUSTOMER_PROFILE_TABLE,
      // IndexName: "byCustomerProfileId",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };
    const getCustomer = await dynamodb.query(paramsGetCustomer).promise();
    console.log(" getCustomer :: ", getCustomer);
    const propExist = getCustomer.Items.some((item) =>
      item.hasOwnProperty("customerId")
    );
    console.log(" propExist ", propExist);
    if (!propExist) {
      customer = await stripe.customers.create();
      console.log("customer :: ", customer);

      let TestUpdateExpression = "";
      let ExpressionAttributeValues = {};
      //TestUpdateExpression += `set ${customerId} = :new${customer.id}`;
      TestUpdateExpression += `set customerId = if_not_exists(customerId, :customerId), customerRes = if_not_exists(customerRes, :customerRes) `;
      ExpressionAttributeValues = {
        ":customerId": customer.id,
        ":customerRes": JSON.stringify(customer),
      };
      const UpdateExpression = TestUpdateExpression;
      //const { id } = getCustomer;
      for (let item of getCustomer.Items) {
        console.log("item :: ", item.id);
        const paramsupdate = {
          TableName: process.env.CUSTOMER_PROFILE_TABLE,
          Key: {
            userId: item.userId,
          },
          UpdateExpression,
          ExpressionAttributeValues,
          ReturnValues: "UPDATED_NEW",
        };
        const updateCustomer = await dynamodb.update(paramsupdate).promise();
        console.log(" updateCustomer  :: ", updateCustomer);
      }

      const params = {
        //payment_method_types: [paymentMethodType],
        amount: totalAmount,
        currency: currency,
        customer: customer.id,
        payment_method_types: ["card"],
        capture_method: "manual",
        transfer_data: {
          destination: "acct_1KrERsQMEFziWAan",
        },
      };
      paymentIntent = await stripe.paymentIntents.create(params);
    } else {
      for (let item of getCustomer.Items) {
        const params = {
          //payment_method_types: [paymentMethodType],
          amount: totalAmount,
          currency: currency,
          customer: item.customerId,
          payment_method_types: ["card"],
          capture_method: "manual",
          transfer_data: {
            destination: "acct_1KrERsQMEFziWAan",
          },
        };

        paymentIntent = await stripe.paymentIntents.create(params);
      }
    }
    return {
      publicKey: STRIPE_PUBLISHABLE_KEY,
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    };
  } catch (err) {
    // return res.status(400).send({
    //   error: {
    //     message: e.message,
    //   },
    // });
    console.log(err);
    return err.message;
  }
};

paymentMethodsList = async (body) => {
  console.log(" inside paymentMethodsList ::");
  const { customerId } = body.input;

  const params = {
    customer: customerId,
    type: "card",
  };
  let defaultPaymentMethodId;
  try {
    const retrieveCustomer = await stripe.customers.retrieve(customerId);
    defaultPaymentMethodId =
      retrieveCustomer.invoice_settings.default_payment_method;
    console.log(
      " retrieveCustomer :: ",
      retrieveCustomer,
      "retrieveCustomer id ",
      defaultPaymentMethodId
    );
    const paymentMethods = await stripe.paymentMethods.list(params);

    return {
      paymentMethods: JSON.stringify(paymentMethods),
      defaultPaymentMethodId: defaultPaymentMethodId,
    };
  } catch (err) {
    // return res.status(400).send({
    //   error: {
    //     message: e.message,
    //   },
    // });
    console.log(err);
    return err.message;
  }
};

saveCustomerCard = async (body) => {
  console.log(" inside saveCustomerCard ::");
  const { userId } = body.input;
  let setUpIntent;
  try {
    let customer;
    const paramsGetCustomer = {
      TableName: process.env.CUSTOMER_PROFILE_TABLE,
      // IndexName: "byCustomerProfileId",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };
    const getCustomer = await dynamodb.query(paramsGetCustomer).promise();
    console.log(" getCustomer :: ", getCustomer);
    const propExist = getCustomer.Items.some((item) =>
      item.hasOwnProperty("customerId")
    );
    console.log(" propExist ", propExist);
    if (!propExist) {
      customer = await stripe.customers.create();
      console.log("customer :: ", customer);

      let TestUpdateExpression = "";
      let ExpressionAttributeValues = {};
      //TestUpdateExpression += `set ${customerId} = :new${customer.id}`;
      TestUpdateExpression += `set customerId = if_not_exists(customerId, :customerId), customerRes = if_not_exists(customerRes, :customerRes) `;
      ExpressionAttributeValues = {
        ":customerId": customer.id,
        ":customerRes": JSON.stringify(customer),
      };
      const UpdateExpression = TestUpdateExpression;
      //const { id } = getCustomer;
      for (let item of getCustomer.Items) {
        console.log("item :: ", item.id);
        const paramsupdate = {
          TableName: process.env.CUSTOMER_PROFILE_TABLE,
          Key: {
            userId: item.userId,
          },
          UpdateExpression,
          ExpressionAttributeValues,
          ReturnValues: "UPDATED_NEW",
        };
        const updateCustomer = await dynamodb.update(paramsupdate).promise();
        console.log(" updateCustomer  :: ", updateCustomer);
      }
      setUpIntent = await stripe.setupIntents.create({
        customer: customer.id,
      });
    } else {
      for (let item of getCustomer.Items) {
        setUpIntent = await stripe.setupIntents.create({
          customer: item.customerId,
        });
      }
    }
    return {
      setUpIntent: JSON.stringify(setUpIntent),
    };
  } catch (err) {
    console.log(err);
    return err.message;
  }
};

deletePaymentMethod = async (body) => {
  console.log(" inside deletePaymentMethod ::");
  const { paymentMethodId } = body.input;

  try {
    const deletedPaymentMethod = await stripe.paymentMethods.detach(
      paymentMethodId
    );
    console.log("deletedPaymentMethod : ", deletedPaymentMethod);
    return {
      success: true,
    };
  } catch (err) {
    // return res.status(400).send({
    //   error: {
    //     message: e.message,
    //   },
    // });
    console.log(err);
    return err.message;
  }
};

defaultPaymentMethod = async (body) => {
  console.log(" inside defaultPaymentMethod ::", body);
  const { paymentMethodId, customer } = body.input;
  const params = {
    invoice_settings: { default_payment_method: paymentMethodId },
  };
  try {
    const defaultPaymentMethod = await stripe.customers.update(
      customer,
      params
    );

    return {
      defaultPaymentMethod: JSON.stringify(defaultPaymentMethod),
    };
  } catch (err) {
    // return res.status(400).send({
    //   error: {
    //     message: e.message,
    //   },
    // });
    console.log(err);
    return err.message;
  }
};

// capturePayment = async (body) => {
//   const { orderShipmenId, amountToCollect, applicationFee, paymentIntentId } = body.input;

//   const params = {
//     amount_to_capture: amountToCollect,
//     application_fee_amount: applicationFee,
//   };

//   try {
//     const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, params);

//     return paymentIntent

//   } catch (err) {
//     // return res.status(400).send({
//     //   error: {
//     //     message: e.message,
//     //   },
//     // });
//     console.log(err);
//     return err.message;
//   }
// };

// createStipeCustomer = async (body) => {
//   const { customerId } = body.input;

//   const params = {
//     customer: customerId,
//     type: 'card',
//   };

//   try {
//     const paymentMethods = await stripe.paymentMethods.list(params);

//     return paymentMethods

//   } catch (err) {
//     // return res.status(400).send({
//     //   error: {
//     //     message: e.message,
//     //   },
//     // });
//     console.log(err);
//     return err.message;
//   }
// };
