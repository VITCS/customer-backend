const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge({ apiVersion: "2015-10-07" });
const { customAlphabet } = require("nanoid");
const alphabet = "0123456789";
const idSize = 16;
const nanoid = customAlphabet(alphabet, idSize);
const taxjar = require("taxjar");
const taxjarClient = new taxjar({
  // apiKey: "7a29a50793b2ff8a3cdd927c5e03d908", // Insert API KEY
  // apiKey: "8779a701170d177dde93a4fab4f4245b", // Insert API KEY
  apiKey: "03fb0bad53f4190b235193635c502313", // Insert API KEY
});

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    switch (event.field) {
      case "createOrderShipment":
        response = await createOrderShipment(event.body);
        break;
      case "updateOrderShipment":
        response = await updateOrderShipment(event.body);
        break;
      case "deleteOrderShipment":
        response = await deleteOrderShipment(event.body);
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
 *  Publish Order Event
 **************************************************************/
publishOrderEvent = async (detailInput, eventType) => {
  // Publish Order Event
  const orderEventParms = {
    Entries: [
      {
        Detail: JSON.stringify(detailInput),
        DetailType: eventType,
        // EventBusName: process.env.EVENT_BUS_NAME,
        EventBusName: process.env.PRD_REJECTION_EVENT_BUS_NAME.includes("prd")
          ? process.env.PRD_REJECTION_EVENT_BUS_NAME
          : "rejection-notification",
        Source: process.env.PRD_EVENT_BUS_SOURCE.includes("prd")
          ? process.env.PRD_EVENT_BUS_SOURCE
          : process.env.TABLE_NAME,
      },
    ],
  };

  const publishResult = await eventbridge.putEvents(orderEventParms).promise();
  console.log("Publish Order Result: ", publishResult);
  // Publish Completed
};

/**************************************************************
 * Create Order Shipment
 **************************************************************/
createOrderShipment = async (body) => {
  try {
    const id = nanoid();
    body.input["id"] = id;
    const params = {
      TableName: process.env.TABLE_NAME,
      Item: body.input,
    };

    let lineItemsTotal = 0;

    if (body.input.orderLineItems && body.input.orderLineItems.length > 0) {
      for (const item of body.input.orderLineItems) {
        item.totalPrice = item.qtyPurchased * item.unitPrice;
        lineItemsTotal += item.qtyPurchased * item.unitPrice;
      }

      if (body.input.deliveryAddress && body.input.storeAddress) {
        const taxjarObj = {
          // from_country: item?.storeAddress?.country,
          from_country: "US",
          from_zip: body.input?.storeAddress?.postCode,
          from_state: body.input?.storeAddress?.state,
          // to_country: item?.deliveryAddress?.country,
          to_country: "US",
          to_zip: body.input?.deliveryAddress?.postCode,
          to_state: body.input?.deliveryAddress?.state,
          amount: body.input?.subTotalProductAmount,
          shipping: 1.5,
          line_items: body.input?.orderLineItems?.map((lineItem) => {
            return {
              quantity: lineItem?.qtyPurchased,
              unit_price: lineItem?.unitPrice,
              storeItem_Id: lineItem?.storeItemId,
              storeProd_Name: lineItem?.storeProdName,
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

        body.input.calculatedTax = resTax?.tax?.amount_to_collect;
      }
      body.input.subTotalProductAmount = lineItemsTotal;
    }

    // await setAsyncTimeout(dynamodb.put(params).promise(), 5000);
    await dynamodb
      .put(params)
      .promise()
      .catch((err) => console.log(err));
    return {
      ...body.input,
      message: "Item successfully Inserted",
    };
  } catch (err) {
    console.error("Error Occured", err);
  }
};

/**************************************************************
 * Update Order Shipment
 **************************************************************/
updateOrderShipment = async (body) => {
  try {
    console.log(body);

    const { id } = body.input;
    const newBody = { ...body.input };
    delete newBody.id;

    let TestUpdateExpression = "";
    let ExpressionAttributeValues = {};
    let i = 0;

    let totalProdAmount = 0;

    // Calculate total price
    if (newBody.orderLineItems && newBody.orderLineItems?.length > 0) {
      for (const lineItem of newBody.orderLineItems) {
        totalProdAmount += lineItem.qtyPurchased * lineItem.unitPrice;
      }

      newBody.subTotalProductAmount = totalProdAmount;
    }

    // TaxJar calculation
    if (newBody.storeAddres && newBody.deliveryAddress) {
      await Promise.all(
        newBody.map(async (item) => {
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
                storeItem_Id: lineItem?.storeItemId,
                storeProd_Name: lineItem?.storeProdName,
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

          item["calculatedTax"] = resTax?.tax?.amount_to_collect;
        })
      );
    }

    for (let item in newBody) {
      if (i === 0) {
        TestUpdateExpression += `set ${item} = :new${item}, `;
        i++;
      } else TestUpdateExpression += `${item} = :new${item}, `;

      ExpressionAttributeValues[`:new${item}`] = newBody[item];
    }

    if (
      body.input.shipmentStatus &&
      body.input.shipmentStatus === "Delivered"
    ) {
      await capturePaymentEvent({ input: body }, "transaction");
    }

    const UpdateExpression = TestUpdateExpression.slice(0, -2);

    console.log(UpdateExpression, ExpressionAttributeValues);

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
      console.log("Shipment status:: ", newBody.shipmentStatus);
      console.log("New body:: ", newBody);
      if (newBody.shipmentStatus === "Rejected") {
        await publishOrderEvent(
          {
            input: {
              shipmentStatus: "Rejected",
              userId: newBody.userId,
              rejectionMsg: newBody.rejectionMsg,
            },
          },
          "Notification-Rejection"
        );
      } else {
        const orderEventParms = {
          Entries: [
            {
              Detail: JSON.stringify({
                input: { id, orderId: newBody.orderId, userId: newBody.userId },
              }),
              DetailType: "Update-OrderShipment",
              // EventBusName: process.env.EVENT_BUS_NAME,
              EventBusName: process.env.PRD_UPDATE_EVENT_BUS_NAME.includes(
                "prd"
              )
                ? process.env.PRD_UPDATE_EVENT_BUS_NAME
                : "update-order",
              Source: process.env.PRD_EVENT_BUS_SOURCE.includes("prd")
                ? process.env.PRD_EVENT_BUS_SOURCE
                : process.env.TABLE_NAME,
            },
          ],
        };
        const publishResult = await eventbridge
          .putEvents(orderEventParms)
          .promise();
        console.log("Publish Order Result Update: ", publishResult);

        if (newBody.shipmentStatus === "Delivered") {
          const orderGetParams = {
            TableName: process.env.ORDER_TABLE,
            Key: {
              id: newBody.orderId,
            },
          };

          const orderRes = await dynamodb.get(orderGetParams).promise();

          const getAllOrderShipmentParams = {
            TableName: process.env.TABLE_NAME,
            IndexName: "byOrderId",
            KeyConditionExpression: "orderId = :orderId",
            ExpressionAttributeValues: {
              ":orderId": newBody.orderId,
            },
          };

          const resOrderShipments = await dynamodb
            .query(getAllOrderShipmentParams)
            .promise();

          let deliveredCount = 0;

          resOrderShipments.Items.forEach((item) => {
            if (item.shipmentStatus === "Delivered") deliveredCount++;
          });

          const newOrderBody = orderRes.Item;

          delete newOrderBody.orderStatus;

          let TestUpdateExpressionOrder = "";
          let ExpressionAttributeValuesOrder = {};

          let k = 0;

          console.log(newOrderBody);
          console.log(deliveredCount);

          delete newOrderBody.id;

          for (let item in newOrderBody) {
            if (k === 0) {
              TestUpdateExpressionOrder += `set ${item} = :new${item}, `;
              k++;
            } else TestUpdateExpressionOrder += `${item} = :new${item}, `;

            ExpressionAttributeValuesOrder[`:new${item}`] = newOrderBody[item];
          }

          TestUpdateExpressionOrder += "orderStatus = :neworderStatus";

          console.log(TestUpdateExpressionOrder);

          if (deliveredCount === resOrderShipments.Items.length - 1) {
            ExpressionAttributeValuesOrder[":neworderStatus"] = "Fulfilled";

            const updateOrderParams = {
              // TableName: process.env.ORDER_TABLE,
              TableName: process.env.ORDER_TABLE,
              Key: {
                id: newBody.orderId,
              },
              UpdateExpression: TestUpdateExpressionOrder,
              ExpressionAttributeValues: ExpressionAttributeValuesOrder,
              ReturnValues: "UPDATED_NEW",
            };

            console.log(ExpressionAttributeValuesOrder);

            await dynamodb.update(updateOrderParams).promise();
          } else {
            ExpressionAttributeValuesOrder[":neworderStatus"] =
              "Partial_Fulfilled";

            const updateOrderParams = {
              // TableName: process.env.ORDER_TABLE,
              TableName: process.env.ORDER_TABLE,
              Key: {
                id: newBody.orderId,
              },
              UpdateExpression: TestUpdateExpressionOrder,
              ExpressionAttributeValues: ExpressionAttributeValuesOrder,
              ReturnValues: "UPDATED_NEW",
            };

            console.log(ExpressionAttributeValuesOrder);

            await dynamodb.update(updateOrderParams).promise();
          }
        } else if (newBody.shipmentStatus === "Cancelled") {
          const orderGetParams = {
            TableName: process.env.ORDER_TABLE,
            Key: {
              id: newBody.orderId,
            },
          };

          const orderRes = await dynamodb.get(orderGetParams).promise();

          const getAllOrderShipmentParams = {
            TableName: process.env.TABLE_NAME,
            IndexName: "byOrderId",
            KeyConditionExpression: "orderId = :orderId",
            ExpressionAttributeValues: {
              ":orderId": newBody.orderId,
            },
          };

          const resOrderShipments = await dynamodb
            .query(getAllOrderShipmentParams)
            .promise();

          let cancelledCount = 0;

          resOrderShipments.Items.forEach((item) => {
            if (item.shipmentStatus === "Cancelled") cancelledCount++;
          });

          const newOrderBody = orderRes.Item;

          delete newOrderBody.orderStatus;

          let TestUpdateExpressionOrder = "";
          let ExpressionAttributeValuesOrder = {};

          let k = 0;

          delete newOrderBody.id;

          for (let item in newOrderBody) {
            if (k === 0) {
              TestUpdateExpressionOrder += `set ${item} = :new${item}, `;
              k++;
            } else TestUpdateExpressionOrder += `${item} = :new${item}, `;

            ExpressionAttributeValuesOrder[`:new${item}`] = newOrderBody[item];
          }

          TestUpdateExpressionOrder += "orderStatus = :neworderStatus";

          if (cancelledCount === resOrderShipments.Items.length - 1) {
            ExpressionAttributeValuesOrder[":neworderStatus"] = "Cancelled";

            const updateOrderParams = {
              // TableName: process.env.ORDER_TABLE,
              TableName: process.env.ORDER_TABLE,
              Key: {
                id: newBody.orderId,
              },
              UpdateExpression: TestUpdateExpressionOrder,
              ExpressionAttributeValues: ExpressionAttributeValuesOrder,
              ReturnValues: "UPDATED_NEW",
            };

            await dynamodb.update(updateOrderParams).promise();
          }
          // else {
          //   ExpressionAttributeValuesOrder[":neworderStatus"] =
          //     "Partial_Fulfilled";

          //   const updateOrderParams = {
          //     // TableName: process.env.ORDER_TABLE,
          //     TableName: "spirits-sit-Order",
          //     Key: {
          //       id: newBody.orderId,
          //     },
          //     UpdateExpression: TestUpdateExpressionOrder,
          //     ExpressionAttributeValues: ExpressionAttributeValuesOrder,
          //     ReturnValues: "UPDATED_NEW",
          //   };

          //   await dynamodb.update(updateOrderParams).promise();
          // }
        }
      }

      // const getOrderParams = {
      //   // TableName: process.env.ORDER_TABLE,
      //   TableName: "spirits-sit-Order",
      //   Key: {
      //     id: newBody.orderId,
      //   },
      // };

      // const orderRes = await dynamodb.get(getOrderParams).promise();

      // let testUpdateOrderExpression = "";
      // let expressionAttributeValuesOrder = {};
      // let j = 0;

      // delete orderRes.Item.id;

      // for (const item in orderRes.Item) {
      //   if (j === 0) {
      //     testUpdateOrderExpression += `set ${item} = :new${item}, `;
      //     j++;
      //   } else testUpdateOrderExpression += `${item} = :new${item}, `;

      //   expressionAttributeValuesOrder[`:new${item}`] = orderRes.Item[item];
      // }

      // const updateOrderExpression = testUpdateOrderExpression.slice(0, -2);

      // console.log(updateOrderExpression, expressionAttributeValuesOrder);

      // const updateOrderParams = {
      //   // TableName: process.env.ORDER_TABLE,
      //   TableName: "spirits-sit-Order",
      //   Key: {
      //     id: newBody.orderId,
      //   },
      //   UpdateExpression: updateOrderExpression,
      //   ExpressionAttributeValues: expressionAttributeValuesOrder,
      //   ReturnValues: "UPDATED_NEW",
      // };

      // const resUpdateOrder = await dynamodb.update(updateOrderParams).promise();
      // console.log("Update order res:: ", resUpdateOrder);

      const res = await dynamodb.update(params).promise();
      console.log(res);
      return {
        id,
        ...res.Attributes,
      };
    } catch (err) {
      console.log("ERROR: ", err);
    }
  } catch (err) {
    console.error("Error Occured", err);
  }
};

/**************************************************************
 * Delete Order Shipment
 **************************************************************/
deleteOrderShipment = async (body) => {
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
    console.error("Error Occured", err);
  }
};

capturePaymentEvent = async (body, eventType) => {
  const params = {
    Entries: [
      {
        Detail: JSON.stringify(body),
        DetailType: eventType,
        EventBusName: "capture-payment",
        Source: process.env.TABLE_NAME,
      },
    ],
  };

  const result = await eventbridge.putEvents(params).promise();
  console.log("Payment capture result: ", result);
};
