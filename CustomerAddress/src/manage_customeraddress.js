const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { customAlphabet } = require("nanoid");
const alphabet = "0123456789";
const idSize = 16;
const nanoid = customAlphabet(alphabet, idSize);
const libphonenumber = require("libphonenumber-js");
/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    switch (event.field) {
      case "createCustomerAddress":
        response = await createCustomerAddress(event.body);
        break;
      case "updateCustomerAddress":
        response = await updateCustomerAddress(event.body);
        break;
      case "updateCustomerAddressesDefault":
        response = await updateCustomerAddressesDefault(event.body);
        break;
      case "deleteCustomerAddress":
        response = await deleteCustomerAddress(event.body);
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
 * Create Customer Address
 **************************************************************/
createCustomerAddress = async (body) => {
  try {
    const id = nanoid();
    body.input["id"] = id;

    const params = {
      TableName: process.env.TABLE_NAME,
      Item: body.input,
    };
    await setAsyncTimeout(dynamodb.put(params).promise(), 5000);
    return {
      ...body.input,
      message: "Item successfully Inserted",
    };
  } catch (err) {
    console.error("Error Occured", err);
  }
};

/**************************************************************
 * Update Customer Address
 **************************************************************/
updateCustomerAddress = async (body) => {
  try {
    console.log(body);

    const { id } = body.input;
    const { state } = body.input;

    let newBody;

    if (state) newBody = { ...body.input, addrState: state };
    else newBody = { ...body.input };

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
      const res = await setAsyncTimeout(
        dynamodb.update(params).promise(),
        5000
      );
      console.log(res);
      return {
        id,
        ...res.Attributes,
      };
    } catch (err) {
      console.log("ERROR: ", err);
    }
  } catch (err) {
    console.error("Error Occured", e);
  }
};

updateCustomerAddressesDefault = async (body) => {
  try {
    const { customerContactId, id, markDefault } = body;

    const getAddressesParams = {
      TableName: process.env.TABLE_NAME,
      IndexName: "byCustomerContactId",
      KeyConditionExpression: "customerContactId = :id",
      ExpressionAttributeValues: {
        ":id": customerContactId,
      },
    };

    const addressData = await setAsyncTimeout(
      dynamodb.query(getAddressesParams).promise(),
      5000
    );

    const updateParams = {
      TableName: process.env.TABLE_NAME,
      Key: {},
      UpdateExpression: "set markDefault = :value",
      ExpressionAttributeValues: {
        ":value": false,
      },
    };

    for (const item of addressData.Items) {
      updateParams["Key"]["id"] = item.id;
      await setAsyncTimeout(dynamodb.update(updateParams).promise(), 5000);
    }

    const updateSingleAddressParam = {
      TableName: process.env.TABLE_NAME,
      Key: {
        id,
      },
      UpdateExpression: "set markDefault = :value",
      ExpressionAttributeValues: {
        ":value": markDefault,
      },
    };

    await setAsyncTimeout(
      dynamodb.update(updateSingleAddressParam).promise(),
      5000
    );

    console.log("Data updated");
  } catch (err) {
    console.log(err);
  }
};

/**************************************************************
 * Delete Customer Address
 **************************************************************/
deleteCustomerAddress = async (body) => {
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
