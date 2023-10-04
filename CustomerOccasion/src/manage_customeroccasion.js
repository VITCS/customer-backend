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
      case "createCustomerOccasion":
        response = await createCustomerOccasion(event.body);
        break;
      case "updateCustomerOccasion":
        response = await updateCustomerOccasion(event.body);
        break;
      case "updateOccasionsReminder":
        response = await updateOccasionsReminder(event.body);
        break;
      case "deleteCustomerOccasion":
        response = await deleteCustomerOccasion(event.body);
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
 * Create Customer Occasion
 **************************************************************/
createCustomerOccasion = async (body) => {
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
 * Update Customer Occasion
 **************************************************************/
updateCustomerOccasion = async (body) => {
  try {
    console.log(body);

    const { id } = body.input;
    const newBody = { ...body.input };
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
    console.error("Error Occured", err);
  }
};

updateOccasionsReminder = async (body) => {
  try {
    const { customerContactId, reminder } = body.input;

    const params = {
      TableName: process.env.TABLE_NAME,
      IndexName: "byCustomerContactId",
      KeyConditionExpression: "customerContactId = :id",
      ExpressionAttributeValues: {
        ":id": customerContactId,
      },
    };

    const data = await setAsyncTimeout(dynamodb.query(params).promise(), 5000);

    const updateParams = {
      TableName: process.env.TABLE_NAME,
      UpdateExpression: "set reminder = :value",
      Key: {},
      ExpressionAttributeValues: {
        ":value": reminder,
      },
    };

    for (item of data.Items) {
      updateParams["Key"]["id"] = item.id;
      await dynamodb.update(updateParams).promise();
    }

    console.log("Data updated");
  } catch (err) {
    console.log(err);
  }
};

/**************************************************************
 * Delete Customer Occasion
 **************************************************************/
deleteCustomerOccasion = async (body) => {
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
