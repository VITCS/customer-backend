const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { customAlphabet } = require("nanoid");
const alphabet = "0123456789";
const idSize = 16;
const nanoid = customAlphabet(alphabet, idSize);

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    switch (event.field) {
      case "createCart":
        response = await createCart(event.body);
        break;
      case "updateCart":
        response = await updateCart(event.body);
        break;
      case "deleteCart":
        response = await deleteCart(event.body);
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
createCart = async (body) => {
  const id = nanoid();
  body.input["id"] = id;
  body.input["createdAt"] = new Date().toLocaleString();
  body.input["updatedAt"] = new Date().toLocaleString();
  let newBody;
  let totalCartAmount = 0;

  if (body.input.cartShipment && body.input.cartShipment.length > 0) {
    newBody = { ...body.input };
    delete body.input.cartShipment;
    const cartShipmentParams = {
      TableName: process.env.SHIPMENT_TABLE_NAME,
    };
    for (const item of newBody.cartShipment) {
      let totalAmnt = 0;
      const newId = nanoid();
      item["id"] = newId;
      item["cartId"] = id;

      if (item.lineItems && item.lineItems.length > 0) {
        for (const i of item.lineItems) {
          const lineItemId = nanoid();
          i["id"] = lineItemId;
          totalAmnt += i.unitPrice * i.qtyPurchased;
          totalCartAmount += i.unitPrice * i.qtyPurchased;
        }
      }

      item["deliveryTip"] = (totalAmnt * 0.1).toFixed(2);
      item["serviceCharge"] = 4.49;
      item["subTotalProductAmount"] = totalAmnt;

      cartShipmentParams["Item"] = item;

      await dynamodb.put(cartShipmentParams).promise();
    }
  }

  const params = {
    TableName: process.env.TABLE_NAME,
    Item: { ...body.input, totalProductAmount: totalCartAmount },
  };
  await dynamodb.put(params).promise();
  return {
    ...body.input,
    cartShipment: { items: newBody ? [...newBody.cartShipment] : null },
    message: "Item successfully Inserted",
  };
};

/**************************************************************
 * Update Customer User
 **************************************************************/
updateCart = async (body) => {
  console.log(body);

  const { id } = body.input;

  let newBody;

  newBody = { ...body.input };

  delete newBody.id;
  delete newBody.cartShipment;

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
  ExpressionAttributeValues[":newUpdatedAt"] = new Date().toLocaleString();

  let UpdateExpression = TestUpdateExpression;

  console.log(UpdateExpression, ExpressionAttributeValues);

  let totalAmnt = 0;

  const newCartShipments = [];
  const createCartShipments = [];
  const updateCartShipments = [];
  const deleteCartShipments = [];

  if (body.input.cartShipment) {
    // const cartShipmentCreate = [];
    // const cartShipmentUpdate = [];

    // for (const item of body.input.cartShipment) {
    //   if (item.id) cartShipmentUpdate.push(item);
    //   else cartShipmentCreate.push(item);
    // }

    // if (cartShipmentUpdate.length > 0) {
    //   for (const cartItemToUpdate of cartShipmentUpdate) {
    //     const newBodyInput = { ...cartItemToUpdate };
    //     delete newBodyInput.id;

    //     let newTestUpdateExpression = "";
    //     let newExpressionAttributeValues = {};
    //     let i = 0;

    //     for (let newItem in newBodyInput) {
    //       if (i === 0) {
    //         newTestUpdateExpression += `set ${newItem} = :new${newItem}, `;
    //         i++;
    //       } else newTestUpdateExpression += `${newItem} = :new${newItem}, `;

    //       newExpressionAttributeValues[`:new${newItem}`] =
    //         newBodyInput[newItem];
    //     }

    //     if (newBodyInput.lineItems && newBodyInput.lineItems.length > 0) {
    //       for (const item of newBodyInput.lineItems) {
    //         totalAmnt += item.qtyPurchased * item.unitPrice;
    //       }
    //     }

    //     newTestUpdateExpression += "updatedAt = :newUpdatedAt";
    //     newExpressionAttributeValues[":newUpdatedAt"] =
    //       new Date().toLocaleString();

    //     const newUpdateExpression = newTestUpdateExpression;

    //     console.log(newUpdateExpression, newExpressionAttributeValues);

    //     const paramsCartShipment = {
    //       TableName: process.env.SHIPMENT_TABLE_NAME,
    //       Key: {
    //         id: cartItemToUpdate.id,
    //       },
    //       UpdateExpression: newUpdateExpression,
    //       ExpressionAttributeValues: newExpressionAttributeValues,
    //       ReturnValues: "UPDATED_NEW",
    //     };

    //     try {
    //       const res = await dynamodb.update(paramsCartShipment).promise();
    //       console.log(res);
    //     } catch (err) {
    //       console.log("ERROR: ", err);
    //     }
    //   }
    // }

    // if (cartShipmentCreate.length > 0) {
    //   const paramsCreate = {
    //     TableName: process.env.SHIPMENT_TABLE_NAME,
    //   };

    //   for (const itemToCreate of cartShipmentCreate) {
    //     if (itemToCreate.lineItems && itemToCreate.lineItems.length > 0) {
    //       for (const item of itemToCreate.lineItems) {
    //         const lineItemId = nanoid();
    //         item['id'] = lineItemId;
    //         totalAmnt += item.qtyPurchased * item.unitPrice;
    //       }
    //     }
    //     const id = nanoid();
    //     paramsCreate["Item"] = { id, ...itemToCreate };

    //     try {
    //       const res = await dynamodb.put(paramsCreate).promise();
    //       console.log(res);
    //     } catch (err) {
    //       console.log(err);
    //     }
    //   }
    // }
    // for (let item in body.input.cartShipment) {
    //   console.log(item.actionType)
    //   switch (body.input.cartShipment[item].actionType) {
    //     case "delete":
    //       const { id } = item;

    //       const deleteParams = {
    //         TableName: "spirits-dev-CartShipment",
    //         Key: {
    //           id,
    //         },
    //       };

    //       try {
    //         await dynamodb.delete(deleteParams).promise()
    //         console.log("Deleted");
    //       } catch (err) {
    //         console.log(err);
    //       }
    //       break;
    //     case "create":
    //       const itemId = nanoid();

    //       const addParams = {
    //         TableName: "spirits-dev-CartShipment",
    //         Item: { id: itemId, ...item },
    //       };

    //       try {
    //         const createdShipment = await dynamodb.put(addParams).promise()
    //         // console.log(createdShipment)
    //         newCartShipments.push(...newCartShipments, createdShipment)
    //         console.log("Added");
    //       } catch (err) {
    //         console.log(err);
    //       }
    //       break;
    //     case "update":
    //       const newId = body.input.cartShipment[item].id

    //       const newBody = { ...body.input.cartShipment[item] };
    //       delete newBody.id;

    //       let TestUpdateExpressionNew = "";
    //       let ExpressionAttributeValuesNew = {};
    //       let i = 0;

    //       for (let item in newBody) {
    //         if (i === 0) {
    //           TestUpdateExpressionNew += `set ${item} = :new${item}, `;
    //           i++;
    //         } else TestUpdateExpressionNew += `${item} = :new${item}, `;

    //         ExpressionAttributeValuesNew[`:new${item}`] = newBody[item];

    //         if (newBody.lineItems && newBody.lineItems.length > 0) {
    //           for (const item of newBody.lineItems) {
    //             totalAmnt += item.qtyPurchased * item.unitPrice;
    //           }
    //         }
    //       }

    //       TestUpdateExpressionNew += "updatedAt = :newUpdatedAt";
    //       ExpressionAttributeValuesNew[":newUpdatedAt"] =
    //         new Date().toLocaleString();

    //       const UpdateExpressionNew = TestUpdateExpressionNew;

    //       console.log(UpdateExpressionNew, ExpressionAttributeValuesNew)

    //       const updateParams = {
    //         TableName: "spirits-dev-CartShipment",
    //         Key: {
    //           id: newId,
    //         },
    //         UpdateExpressionNew,
    //         ExpressionAttributeValuesNew,
    //         ReturnValues: "UPDATED_NEW",
    //       };

    //       try {
    //         const updatedCartShipment = await dynamodb.update(updateParams).promise()
    //         console.log('Update Cart Shipment: ', updatedCartShipment.Attributes)
    //         newCartShipments.push(...newCartShipments, ...updatedCartShipment.Attributes);
    //         console.log("Updated");
    //       } catch (err) {
    //         console.log(err);
    //       }
    //   }
    // }

    for (const item of body.input.cartShipment) {
      switch (item.actionType) {
        case "create":
          const createId = nanoid();
          createCartShipments.push({
            PutRequest: {
              Item: {
                id: createId,
                ...item,
              },
            },
          });
          break;
        case "update":
          updateCartShipments.push({
            PutRequest: {
              Item: {
                ...item,
              },
            },
          });
          break;
        case "delete":
          deleteCartShipments.push({
            DeleteRequest: {
              Key: {
                id: item.id,
              },
            },
          });
          break;
      }
    }

    const paramsCartShipmentUpdate = {
      RequestItems: {
        [process.env.SHIPMENT_TABLE_NAME]: updateCartShipments,
      },
    };

    const paramsCartShipmentDelete = {
      RequestItems: {
        [process.env.SHIPMENT_TABLE_NAME]: deleteCartShipments,
      },
    };

    const paramsCartShipmentCreate = {
      RequestItems: {
        [process.env.SHIPMENT_TABLE_NAME]: createCartShipments,
      },
    };

    console.log(updateCartShipments);

    let updateCartShipmentRes, createCartShipmentRes, deleteCartShipmentRes;

    if (updateCartShipments.length > 0)
      updateCartShipmentRes = await dynamodb
        .batchWrite(paramsCartShipmentUpdate)
        .promise();
    if (createCartShipments.length > 0)
      createCartShipmentRes = await dynamodb
        .batchWrite(paramsCartShipmentCreate)
        .promise();
    if (deleteCartShipments.length > 0)
      deleteCartShipmentRes = await dynamodb
        .batchWrite(paramsCartShipmentDelete)
        .promise();

    // console.log(
    //   "Final values: ",
    //   updateCartShipmentRes.Attributes,
    //   createCartShipmentRes,
    //   deleteCartShipmentRes
    // );
  }

  ExpressionAttributeValues[":newtotalAmount"] = totalAmnt;

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

  let cartShipmentReturn = [];

  if (body.input.cartShipment.length > 0) {
    cartShipmentReturn = {
      items: [...body.input.cartShipment],
    };
  }

  console.log("Return: ", cartShipmentReturn);

  try {
    const res = await dynamodb.update(params).promise();
    console.log("Updated Cart: ", res.Attributes);
    console.log(body.input.cartShipment);
    const retValue = body.input.cartShipment;
    return {
      id,
      ...res.Attributes,
      // cartShipment: body.input.cartShipment.length > 0 ? {"items": [...body.input.cartShipment]} : []
      // cartShipment: {
      //   items: body.input.cartShipment
      // }
      cartShipment: {
        items: retValue,
      },
    };
  } catch (err) {
    console.log("ERROR: ", err);
  }
};

/**************************************************************
 * Delete Customer User
 **************************************************************/
deleteCart = async (body) => {
  try {
    console.log(body);

    const params = {
      TableName: process.env.TABLE_NAME,
      Key: {
        id: body.input.id,
      },
    };

    try {
      await dynamodb.delete(params).promise();
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
