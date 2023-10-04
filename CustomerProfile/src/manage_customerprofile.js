const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const eventbridge = new AWS.EventBridge({ apiVersion: "2015-10-07" });
const awsRegion = process.env.AWS_REGION;
const cognito = new AWS.CognitoIdentityServiceProvider({
  apiVersion: "2016-04-18",
  region: awsRegion,
});
const { customAlphabet } = require("nanoid");
const alphabet = "0123456789";
const idSize = 16;
const nanoid = customAlphabet(alphabet, idSize);
const libphonenumber = require("libphonenumber-js");
const customerUserPoolId = process.env.CUSTOMER_USER_POOL_ID;
const { Blob } = require("node:buffer");
/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    switch (event.field) {
      case "createCustomerProfile":
        response = await createCustomerProfile(event.body);
        break;
      case "createProfileAddressOccasion":
        response = await createProfileAddressOccasion(event.body);
        break;
      case "updateCustomerProfile":
        response = await updateCustomerProfile(event.body);
        break;
      case "deleteCustomerProfile":
        response = await deleteCustomerProfile(event.body);
        break;
      case "createUserSocial":
        response = await createUserSocial(event.body);
        break;
      case "getPDFDownload":
        response = await getPDFDownload(event.body, event.identity);
        break;
      // case "createUserWest":
      //   response = await createUserWest(event.body);
      //   break;
      // case "updateUserWest":
      //   response = await updateUserWest(event.body);
      //   break;
    }
  } catch (e) {
    console.error("Error Occured", e);
  }
  return response;
};

// const setAsyncTimeout = (cb, timeout = 0) =>
//   new Promise((resolve, reject) => {
//     resolve(cb);
//     setAsyncTimeout(
//       () => reject("Request is taking too long to response"),
//       timeout
//     );
//   });

/**************************************************************
 * Create Customer User
 **************************************************************/
createCustomerProfile = async (body) => {
  try {
    const id = nanoid();
    body.input["id"] = id;

    const { phoneNumber } = body.input;

    const sepNumber = new libphonenumber.AsYouType().input(phoneNumber);
    const newNumArr = sepNumber.split(" ");
    const countryCode = newNumArr.shift();
    const finalNumber = `${countryCode} ${newNumArr.join("")}`;
    console.log(finalNumber);

    body.input["phoneNumber"] = finalNumber;

    const params = {
      TableName: process.env.TABLE_NAME,
      Item: body.input,
    };
    // await setAsyncTimeout(dynamodb.put(params).promise(), 5000);
    await dynamodb.put(params).promise();
    return {
      ...body.input,
      message: "Item successfully Inserted",
    };
  } catch (err) {
    console.log(err);
  }
};

/**************************************************************
 * Create Address, Contact & Occasion
 **************************************************************/
createProfileAddressOccasion = async (body) => {
  try {
    const contactId = nanoid();

    const {
      CustomerContactInput,
      CustomerAddressInput,
      CustomerOccasionInput,
    } = body.input;

    const customerContactParams = {
      TableName: process.env.CONTACT_TABLE_NAME,
      Item: {
        id: contactId,
        ...CustomerContactInput,
      },
    };

    for (let item of CustomerAddressInput) {
      const id = nanoid();
      item["id"] = id;

      const customerAddressParams = {
        TableName: process.env.ADDRESS_TABLE_NAME,
        Item: {
          customerContactId: contactId,
          ...item,
        },
      };

      await dynamodb.put(customerAddressParams).promise();

      // dynamodb.put(customerAddressParams).promise(),
      // await setAsyncTimeout(
      //   dynamodb.put(customerAddressParams).promise(),
      //   5000
      // );
    }

    if (CustomerOccasionInput.length > 0) {
      for (let item of CustomerOccasionInput) {
        const id = nanoid();
        item["id"] = id;

        const customerOccasionParams = {
          TableName: process.env.OCCASION_TABLE_NAME,
          Item: {
            customerContactId: contactId,
            ...item,
          },
        };

        // await setAsyncTimeout(
        //   dynamodb.put(customerOccasionParams).promise(),
        //   5000
        // );
        await dynamodb.put(customerOccasionParams).promise();
      }
    }

    await dynamodb.put(customerContactParams).promise();

    return {
      customerContact: { id: contactId, ...CustomerContactInput },
      customerAddress: { items: [...CustomerAddressInput] },
      customerOccasion: { items: [...CustomerOccasionInput] },
    };
  } catch (err) {
    console.log(err);
  }
};

/**************************************************************
 * Update Customer User
 **************************************************************/
updateCustomerProfile = async (body) => {
  try {
    console.log(body);

    const { userId } = body.input;
    const newBody = { ...body.input };
    delete newBody.userId;
    let phoneNumber;
    if (
      body.input.phoneNumber !== null &&
      body.input.hasOwnProperty("phoneNumber")
    ) {
      phoneNumber = body.input.phoneNumber.split(" ").join("");
    }
    const email = body.input.email;
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
        userId,
      },
      UpdateExpression,
      ExpressionAttributeValues,
      ReturnValues: "UPDATED_NEW",
    };

    const queryContactParams = {
      TableName: process.env.CONTACT_TABLE_NAME,
      IndexName: "byCustomerProfileId",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
        ":cat": "Self",
      },
      FilterExpression: "contactCategory = :cat",
    };

    const updateContactParams = {
      TableName: process.env.CONTACT_TABLE_NAME,
      Key: {},
      UpdateExpression,
      ExpressionAttributeValues,
      ReturnValues: "UPDATED_NEW",
    };

    try {
      if (phoneNumber !== null && body.input.hasOwnProperty("phoneNumber")) {
        const paramsCognitoUpdate = {
          UserPoolId: customerUserPoolId,
          Username: userId,
          UserAttributes: [
            {
              Name: "phone_number",
              Value: phoneNumber,
            },
          ],
        };
        console.log(" paramsCognitoUpdate : ", paramsCognitoUpdate);
        const resCognito = await cognito
          .adminUpdateUserAttributes(paramsCognitoUpdate)
          .promise();
        console.log(resCognito);
      }

      if (email !== null && body.input.hasOwnProperty("email")) {
        const paramsCognitoUpdateEmail = {
          UserPoolId: customerUserPoolId,
          Username: userId,
          UserAttributes: [
            {
              Name: "email",
              Value: email,
            },
          ],
        };
        console.log(" paramsCognitoUpdateEmail : ", paramsCognitoUpdateEmail);
        const resCognitoEmail = await cognito
          .adminUpdateUserAttributes(paramsCognitoUpdateEmail)
          .promise();
        console.log(resCognitoEmail);
      }
      const data = await dynamodb.query(queryContactParams).promise();

      updateContactParams["Key"]["id"] = data.Items[0].id;

      // const res = await setAsyncTimeout(
      //   dynamodb.update(params).promise(),
      //   5000
      // );

      const res = await dynamodb.update(params).promise();

      // const resContactUpdate = await setAsyncTimeout(
      //   5000,
      //   dynamodb.update(updateContactParams).promise()
      // );

      const resContactUpdate = await dynamodb
        .update(updateContactParams)
        .promise();

      console.log(res);
      console.log(resContactUpdate);
      
      const customerProfileEventParms = {
        Entries: [
          /* required */
          {
            Detail: JSON.stringify({
              input: { 
                username: body.username, 
                email: body.input.email, 
                phone_number: body.input.phoneNumber, 
                given_name: body.input.firstName, 
                family_name: body.input.lastName, 
                // email_verified, 
                // phone_number_verified,
             },
             }),
            DetailType: 'cognito user update',
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.TABLE_NAME,
          },
        ],
      };
  
      const result = await eventbridge.putEvents(customerProfileEventParms).promise();
      console.log("customerProfileEvent  result:: ", result);
      console.log("customerProfileEvent Parameters:: ", customerProfileEventParms);
  
      await publishcustomerProfileEvent(
        {  input: { 
               username: body.username, 
               email: body.input.email, 
               phone_number: body.input.phoneNumber, 
               given_name: body.input.firstName, 
               family_name: body.input.lastName, 
              //  email_verified, 
              //  phone_number_verified,
              },
        }, 
           "cognito user update"
       );
      return {
        userId,
        ...res.Attributes,
      };
    } catch (err) {
      console.log("ERROR: ", err);
    }
  } catch (err) {
    console.log(err);
  }
};

/**************************************************************
 * Delete Customer User
 **************************************************************/
deleteCustomerProfile = async (body) => {
  console.log(body);

  const params = {
    TableName: process.env.TABLE_NAME,
    Key: {
      userId: body.input.userId,
    },
  };

  try {
    // await setAsyncTimeout(dynamodb.delete(params).promise(), 5000);
    await dynamodb.delete(params).promise();
    return {
      ...body.input,
      message: "Item successfully deleted",
    };
  } catch (err) {
    console.log("ERROR: ", err);
    throw err;
  }
};

/**********************
 *  Publish customerProfile Event
 **********************/
publishcustomerProfileEvent = async (detailInput, eventType) => {
  // Publish customerProfile Event
  const customerProfileEventParams = {
    Entries: [
      {
        Detail: JSON.stringify(detailInput),
        DetailType: eventType,
        EventBusName: process.env.EVENT_BUS_NAME,
        Source: process.env.TABLE_NAME,
      },
    ],
  };
  const publishResult = await eventbridge.putEvents(customerProfileEventParams).promise();
  console.log("Publish customerProfile Result: ", publishResult);
  console.log("customerProfileEvent Parameters: ", customerProfileEventParams);
  // Publish Completed
};

/**************************************************************
 * Create User Social Login
 *************************************************************/
createUserSocial = async (body) => {
  try {
    const {
      createCustomerProfileInput,
      createCustomerAddressInput,
      createCustomerContactInput,
    } = body.input;

    const idCustomerProfile = nanoid();
    const idCustomerContact = nanoid();
    const idCustomerAddress = nanoid();

    const customerProfileParamsInsert = {
      // TableName: process.env.CustomerProfileTable,
      TableName: "spirits-sit-CustomerProfile",
      Item: {
        ...createCustomerProfileInput,
        id: idCustomerProfile,
        deliveryTo: true,
        notificationDefault: true,
        replacementDefault: true,
        deliveryToId: idCustomerAddress,
        createdAt: new Date().toISOString(),
      },
    };

    const customerContactParamsInsert = {
      // TableName: process.env.CustomerContactTable,
      TableName: "spirits-sit-CustomerContact",
      Item: {
        ...createCustomerContactInput,
        id: idCustomerContact,
        contactCategory: "Self",
        createdAt: new Date().toISOString(),
      },
    };

    const newAddress = { ...createCustomerAddressInput };
    delete newAddress.addrState;

    const customerAddressParamsInsert = {
      // TableName: process.env.CustomerAddressTable,
      TableName: "spirits-sit-CustomerAddress",
      Item: {
        id: idCustomerAddress,
        state: newAddress.addrState,
        createdAt: new Date().toISOString(),
        customerContactId: idCustomerContact,
        ...createCustomerAddressInput,
      },
    };

    await dynamodb.put(customerProfileParamsInsert).promise();

    await dynamodb.put(customerContactParamsInsert).promise();

    await dynamodb.put(customerAddressParamsInsert).promise();

    return {
      customerAddress: { id: idCustomerAddress, ...createCustomerAddressInput },
      customerProfile: { id: idCustomerProfile, ...createCustomerProfileInput },
      customerContact: { id: idCustomerContact, ...createCustomerContactInput },
    };
  } catch (err) {
    console.log(err);
  }
};

/**************************************************************
 * Get PDF Download
 *************************************************************/
getPDFDownload = async (body, identity) => {
  try {
    if (identity.claims.username) {
      if (body.userId === identity.claims.username) {
        const s3 = new AWS.S3();

        const params = {
          Bucket: "843219620739-spirits-shipmentconfirmation",
          Key: `shipment-confirmations/sit/${body.userId}/${body.shipmentId}-${body.userId}.pdf`,
        };

        // const res = await s3.getObject(params).promise();

        // console.log(res);

        // console.log(res.Body.toString())

        // const blob = new Blob([res.Body.toString()], {type: 'application/pdf'})

        // console.log('Blob:: ', blob.toString());

        // // const url = URL.createObjectURL(blob);

        // // return url;

        // return blob;

        const url = await s3.getSignedUrlPromise("getObject", params);

        return url;
      }
    }
  } catch (err) {
    console.log(err);
  }
};

/**************************************************************
 * Get PDF Download
 *************************************************************/
createUserWest = async (body) => {
  try {
    const poolId = "us-west-2_3tB8878IH";

    const signUpData = {
      // ClientId: "55l0q41s140smb5jae47kgs4o",
      UserPoolId: poolId,
      Username: body.username,
      UserAttributes: [
        {
          Name: "email",
          Value: body.email,
        },
        {
          Name: "phone_number",
          Value: body.phoneNumber,
        },
        {
          Name: "given_name",
          Value: body.firstName,
        },
        {
          Name: "family_name",
          Value: body.lastName,
        },
        {
          Name: "email_verified",
          Value: "true",
        },
        {
          Name: "phone_number_verified",
          Value: "true",
        },
      ],
    };

    await cognito.adminCreateUser(signUpData).promise();

    const passwordData = {
      UserPoolId: poolId,
      Password: body.password,
      Username: body.username,
      Permanent: true,
    };

    await cognito.adminSetUserPassword(passwordData).promise();

    return "User added successfully";
  } catch (err) {
    console.log("ERROR:: ", err);
    return err?.message ? err.message : "Unable to add contact";
  }
};

/**************************************************************
 * Get PDF Download
 *************************************************************/
updateUserWest = async (body) => {
  try {
    const poolId = "us-west-2_3tB8878IH";

    if (body.type?.toLowerCase() === "password") {
      const passwordData = {
        UserPoolId: poolId,
        Username: body.username,
        Password: body.password,
        Permanent: true,
      };

      await cognito.adminSetUserPassword(passwordData).promise();

      return "Password updated successfully";
    } else if (body.type?.toLowerCase() === "user") {
      const tempBody = JSON.parse(JSON.stringify(body));
      delete tempBody.type;
      delete tempBody.username;
      if (tempBody?.password) {
        delete tempBody.password;
      }

      const updateObjArray = [];

      for (const item in tempBody) {
        updateObjArray.push({
          Name: item,
          Value: tempBody[item],
        });
      }

      const updateData = {
        UserPoolId: poolId,
        UserAttributes: updateObjArray,
        Username: body.username,
      };

      await cognito.adminUpdateUserAttributes(updateData).promise();

      return "User updated successfully";
    } else {
      return "Invalid operation";
    }
  } catch (err) {
    console.log("ERROR:: ", err);
    return err?.message ? err.message : "Unable to perform the operation";
  }
};
