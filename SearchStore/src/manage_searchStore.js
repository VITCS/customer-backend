const AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });
const location = new AWS.Location();
const axios = require("axios");
const elasticsearch = require("elasticsearch");
// const fetch = require('node-fetch');
const awsHttpClient = require("http-aws-es");

// let client = new elasticsearch.Client({
//   //host: '<YOUR_ES_CLUSTER_ID>.<YOUR_ES_REGION>.es.amazonaws.com',
//   host: "https://search-spirits-dev-es-5rxmmgmdh4kmqjbrk566m2cmqq.us-east-1.es.amazonaws.com",
//   connectionClass: awsHttpClient,
//   path: "/spirits-dev-store/_search",
//   amazonES: {
//     region: "us-east-1",
//     // credentials: new AWS.Credentials(
//     //   "AKIA4IU6OKOBYGHB5F6A",
//     //   "iVWmpWxAi1iCTv9K/M7Q/EwzvUVCJ1sB+B6g+Oc7"
//     // ),
//     accessKey: "AKIA4IU6OKOBXILST3V2",
//     secretKey: "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",
//   },
// });

// client.search({
//   index: "spirits-dev-es",
//   type: "dynamic",
//   body: {
//     query: {
//       bool: {
//         must: [
//           {
//             match_all: {},
//           },
//         ],
//         filter: [
//           {
//             //   geo_distance: {
//             //     distance: $dist$unit,
//             //     geoPoint: {
//             //       lat: $ctx.args.lat,
//             //       lon: $ctx.args.lon,
//             //     },
//             //   },
//             geo_distance: {
//               distance: "400mi",
//               geoPoint: {
//                 lat: 40,
//                 lon: -70,
//               },
//             },
//           },
//         ],
//       },
//     },
//   },
// });
//   .then((res) => console.log(res))
//   .catch((err) => console.log(err));

// client.search(
//   {
//     index: "spirits-dev-product",
//     type: "products",
//     body: {
//       query: {
//         match_all: {},
//       },
//       //   size: 10,
//     },
//   },
//   (err, res) => {
//     if (err) console.log(err);
//     else console.log(res);
//   }
// );

// client.ping(
//   {
//     requestTimeout: 30000,
//   },
//   (err, res) => {
//     if (err) console.log(err);
//     else console.log(res, "Connected");
//   }
// );

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");

  const getData = async () => {
    try {
      const client = new elasticsearch.Client({
        host: process.env.ES_LINK,
        connectionClass: awsHttpClient,
        amazonES: {
          region: "us-east-1",
          credentials: new AWS.EnvironmentCredentials("AWS"),
        },
      });

      const response = await client.search({
        index: process.env.INDEX_NAME,
        scroll: "30s",
        size: 10,
        body: {
          query: {
            bool: {
              must: {
                match_all: {},
              },
              filter: {
                geo_distance: {
                  distance: `${event.body.distance}mi`,
                  "address.geoPoint": {
                    lat: event.body.lat,
                    lon: event.body.lon,
                  },
                },
              },
            },
          },
          sort: [
            {
              _geo_distance: {
                "address.geoPoint": {
                  lat: event.body.lat,
                  lon: event.body.lon,
                },
                order: "asc",
                unit: "mi",
                mode: "min",
                distance_type: "arc",
                ignore_unmapped: true,
              },
            },
          ],
        },
      });

      console.log("First response:: ", response.hits.hits);

      // const newRes = await client.search({
      //   index: "spirits-dev-store",
      //   scroll: "30s",
      //   size: value,
      //   body: {
      //     query: {
      //       bool: {
      //         must: {
      //           match_all: {},
      //         },
      //         filter: {
      //           geo_distance: {
      //             distance: `${event.body.distance}mi`,
      //             "address.geoPoint": {
      //               lat: event.body.lat,
      //               lon: event.body.lon,
      //             },
      //           },
      //         },
      //       },
      //     },
      //   },
      // });

      // console.log('First Response:: ', newRes.hits.hits.length);

      const newData = await Promise.all(
        response.hits.hits.map(async (item) => {
          const params = {
            CalculatorName: process.env.ROUTE_CALCULATOR,
            DeparturePosition: [event.body.lon, event.body.lat],
            DestinationPosition: [
              item._source.address.geoPoint.lon,
              item._source.address.geoPoint.lat,
            ],
            //   DeparturePosition: [-123.4567, 45.6789],
            //   DestinationPosition: [-123.123, 45.234],
          };

          const data = await location.calculateRoute(params).promise();

          // console.log('Location data:: ', data);

          return {
            ...item._source,
            distance: data.Summary.Distance,
            timeReq: data.Summary.DurationSeconds,
          };
        })
      );

      // console.log('Finised')

      console.log("Data:: ", newData);

      return newData;
    } catch (err) {
      console.log(err);
    }
  };

  const res = await getData();

  console.log(res);

  return {
    items: [...res],
  };
};

// const params = {
//   CalculatorName: "spirits-dev-platform-Esri-routeCalculator",
//   DeparturePosition: [-74.62813, 40.27478],
//   DestinationPosition: [-74.57190636621206, 39.356022991577625],
//   //   DeparturePosition: [-123.4567, 45.6789],
//   //   DestinationPosition: [-123.123, 45.234],
// };

// location.calculateRoute(params, (err, data) => {
//   if (err) console.log(err);
//   else console.log(data);
// });
