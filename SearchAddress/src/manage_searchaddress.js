const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();
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
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    switch (event.field) {
      case "searchAddress":
        response = await searchAddress(event.body);
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

const searchAddress = async (body) => {
  console.log("In the function");

  // const secretClient = new AWS.SecretsManager({
  //   region: "us-east-1",
  // });

  console.log("body input ::", body.input);
  const { includeCities, includeStates, searchStr } = body.input;

  try {
    // const InitialKey = await secretClient
    //   .getSecretValue({
    //     SecretId: "spirits-dev-SmartyStreetsSecretKey",
    //   })
    //   .promise();

    // const InitialKey = await setAsyncTimeout(
    //   await secretClient
    //     .getSecretValue({
    //       SecretId: "spirits-dev-SmartyStreetsSecretKey",
    //     })
    //     .promise()
    // );

    // const key = JSON.parse(InitialKey.SecretString).secret;

    // const keyParams = {
    //   Name: "/spirits/smartyStreetsSecret",
    //   WithDecryption: true,
    // };
    const keyParamsAuthId = {
      Name: "/spirits/smartyStreetsSecret/authId",
      WithDecryption: true,
    };

    const keyParameterauthID = await ssm.getParameter(keyParamsAuthId).promise();
    const authID = keyParameterauthID.Parameter.Value;
    
    const keyParamsAuthToken = {
      Name: "/spirits/smartyStreetsSecret/authToken",
      WithDecryption: true,
    };

    const keyParameterauthToken = await ssm.getParameter(keyParamsAuthToken).promise();
    const authToken = keyParameterauthToken.Parameter.Value;
    

    console.log("authID :: ", authID, " authToken :: ",authToken);
    // const url = `https://us-autocomplete-pro.api.smartystreets.com/lookup?key=${key}&search=${searchStr}&include_only_cities=${
    //   includeCities ? includeCities.join(";") : ""
    // }&include_only_states=${includeStates ? includeStates.join(";") : ""}`;
    const url = `https://us-autocomplete-pro.api.smartystreets.com/lookup?search=${searchStr}&auth-id=${authID}&auth-token=${authToken}`;
    
// https://us-street.api.smartystreets.com/street-address?street=123+main+Schenectady+NY&auth-id=8d497be5-e211-4949-a18f-0bfd1d9970d3&auth-token=th4hargQiuyG7w7L7xfO
//&auth-id=8d497be5-e211-4949-a18f-0bfd1d9970d3
	// &auth-token=th4hargQiuyG7w7L7xfO
    console.log("url :: ");
    const data = await fetch(url, {
      method: "get",
      headers: {
        Host: "us-autocomplete-pro.api.smartystreets.com",
        //Host: "us-street.api.smartystreets.com",
        //Referer: "www.1800spirits.com",
      },
    });

    console.log("data :: ", data);
    // const data = await setAsyncTimeout(
    //       await fetch(url, {
    //         method: "get",
    //         headers: {
    //           Host: "us-autocomplete-pro.api.smartystreets.com",
    //           Referer: "www.1800spirits.com",
    //         },
    //       })
    //     );
    let _str = "";

    data.body.on("data", (data) => {
      _str = `${_str} ${data.toString()}`;
    });

    const _finalData = await new Promise((resolve) => {
      data.body.on("end", () => {
        resolve(_str);
      });
    });

    return { items: JSON.parse(_finalData).suggestions };
  } catch (err) {
    console.log(err);
  }
};
