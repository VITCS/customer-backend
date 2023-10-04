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
      case "createCartShipment":
        response = await createCartShipment(event.body);
        break;
      case "updateCartShipment":
        response = await updateCartShipment(event.body);
        break;
      case "deleteCartShipment":
        response = await deleteCartShipment(event.body);
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
createCartShipment = async (body) => {
  try {
    const id = nanoid();
    body.input["id"] = id;
    body.input["createdAt"] = new Date().toLocaleString();
    body.input["updatedAt"] = new Date().toLocaleString();

    if (body.input.lineItems && body.input.lineItems.length > 0) {
      for (const item of body.input.lineItems) {
        const newId = nanoid();
        item["id"] = newId;
      }
    }

    const params = {
      TableName: process.env.TABLE_NAME,
      Item: body.input,
    };
    await setAsyncTimeout(dynamodb.put(params).promise(), 5000);
    return {
      ...body.input,
      lineItems: body.input.lineItems ? [...body.input.lineItems] : null,
      message: "Item successfully Inserted",
    };
  } catch (err) {
    console.error("Error Occured", err);
  }
};

/**************************************************************
 * Update Customer User
 **************************************************************/
updateCartShipment = async (body) => {
  try {
    console.log(body);

    const { id } = body.input;

    let newBody;

    newBody = { ...body.input };

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
    ExpressionAttributeValues[":newUpdatedAt"] = new Date().toLocaleString();

    const UpdateExpression = TestUpdateExpression;

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
      // const res = await setAsyncTimeout(
      //   dynamodb.update(params).promise(),
      //   5000
      // );
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
 * Delete Customer User
 **************************************************************/
deleteCartShipment = async (body) => {
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
