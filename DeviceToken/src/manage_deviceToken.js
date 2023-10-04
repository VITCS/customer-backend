const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { customAlphabet } = require("nanoid");
const alphabet = "0123456789";
const idSize = 16;
const nanoid = customAlphabet(alphabet, idSize);
const libphonenumber = require("libphonenumber-js");
const fetch = require("node-fetch");

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  try {
    switch (event.field) {
      case "createDeviceToken":
        response = await createDeviceToken(event.body);
        break;
      case "updateDeviceToken":
        response = await updateDeviceToken(event.body);
        break;
      case "deleteDeviceToken":
        response = await deleteDeviceToken(event.body);
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
createDeviceToken = async (body) => {
  try {
  // const id = nanoid();
  // body.input["id"] = id;

  const params = {
    TableName: process.env.TABLE_NAME,
    Item: body.input,
  };
  await setAsyncTimeout(dynamodb.put(params).promise(), 5000);
  return {
    ...body.input,
    message: "Item successfully Inserted",
  };
}
catch (err) {
  console.error("Error Occured", err);
}
};

/**************************************************************
 * Update Customer User
 **************************************************************/
updateDeviceToken = async (body) => {
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

  const UpdateExpression = TestUpdateExpression.slice(0, -2);

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
    const res = await setAsyncTimeout(dynamodb.update(params).promise(),5000);
    console.log(res);
    return {
      id,
      ...res.Attributes,
    };
  } catch (err) {
    console.log("ERROR: ", err);
  }
}
catch (err) {
  console.error("Error Occured", err);
}
};

/**************************************************************
 * Delete Customer User
 **************************************************************/
deleteDeviceToken = async (body) => {
  try {
  console.log(body);

  const params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      id: body.input.id,
    },
  };

  try {
    await setAsyncTimeout(dynamodb.delete(params).promise(),5000);
    return {
      ...body.input,
      message: "Item successfully deleted",
    };
  } catch (err) {
    console.log("ERROR: ", err);
    throw err;
  }
}
catch (err) {
  console.error("Error Occured", err);
}
};
