const AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });
const s3 = new AWS.S3();
const axios = require("axios");

/**************************************************************
 * Helper Function
 **************************************************************/
const comparePriceFunc = (item1, item2) => {
  if (Number(item1.price) < Number(item2.price)) {
    return -1;
  }

  if (Number(item1.price > Number(item2.price))) {
    return 1;
  }

  return 0;
};

const groupBy = function (xs, key) {
  return xs.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  console.log("Received event:: ", event);

  if (!event) throw new Error("Event not found");

  try {
    const searchProductsQuery = `
        query SEARCH_PRODUCTS($filter: SearchableProductFilterInput, $sort: SearchableProductSortInput, $limit: Int, $nextToken: String, $from: Int) {
          searchProducts(filter: $filter, sort: $sort, limit: $limit, nextToken: $nextToken, from: $from) {
            total
            items {
              id
              prodFullName
              prodName
              prodCategory
              imageFile
              images
              brandLine
              manufacturer
              prodMinor
              region
              abv
            }
            ProdCategory {
              key
              doc_count
            }
            ProdFullName {
              key
              doc_count
            }
            ProdMajor {
              key
              doc_count
            }
            ProdMinor {
              key
              doc_count
            }
            brand {
              key
              doc_count
            }
            container {
              key
              doc_count
            }
            country {
              key
              doc_count
            }
            majorType {
              key
              doc_count
            }
            manufacturer {
              key
              doc_count
            }
          }
        }
      `;

    const searchProductsRes = await axios({
      method: "POST",
      url: process.env.API_URL,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "da2-5cdg6ipverajdo6zwgiswnnhqu",
      },
      data: JSON.stringify({
        query: searchProductsQuery,
        variables: {
          filter: event.body.filter,
          limit: event.body.limit,
          from: event.body.from,
          sort: event.body.sort,
        },
      }),
    });

    console.log(
      "Res:: ",
      searchProductsRes.data.data.searchProducts.items.length
    );

    console.log("prod:: ", searchProductsRes.data.data.searchProducts.items);

    if (searchProductsRes.data.data.searchProducts?.items?.length > 0) {
      await Promise.all(
        searchProductsRes.data.data.searchProducts.items.map(async (item) => {
          if (item?.imageFile) {
            const params = {
              Bucket: "1800spirits-images",
              Key: `product/${item.imageFile}`,
            };

            const res = await s3.getSignedUrlPromise("getObject", params);

            item.images = [res];
          }
        })
      );
    }

    const searchPriceAndAvailabilityFilter =
      searchProductsRes.data.data.searchProducts.items.map((item) => {
        return {
          id: { eq: item.id },
        };
      });

    // console.log(searchPriceAndAvailabilityFilter);
    // console.log(searchPriceAndAvailabilityFilter.length);

    const searchPriceAndAvailabilitysQuery = `
      query SEARCH_PRICE_QUERY($filter: SearchablePriceAndAvailabilityFilterInput) {
        searchPriceAndAvailabilitys(filter: $filter) {
          total
          items {
            id
            storeId
            price
          }
        }
      }
    `;

    const searchPriceAndAvailabilitysRes = await axios({
      method: "POST",
      url: process.env.API_URL,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "da2-5cdg6ipverajdo6zwgiswnnhqu",
      },
      data: JSON.stringify({
        query: searchPriceAndAvailabilitysQuery,
        variables: {
          filter: event.body?.merchantAccountId
            ? {
                and: [
                  { merchantAccountId: { eq: event.body.merchantAccountId } },
                  { or: searchPriceAndAvailabilityFilter },
                ],
              }
            : { or: searchPriceAndAvailabilityFilter },
        },
      }),
    });

    // console.log(
    //   "Res:: ",
    //   searchPriceAndAvailabilitysRes.data.data.searchPriceAndAvailabilitys
    // );

    if (
      searchPriceAndAvailabilitysRes.data.data.searchPriceAndAvailabilitys.items
        .length > 0
    ) {
      for (const itemProduct of searchProductsRes.data.data.searchProducts
        .items) {
        for (const itemPrice of searchPriceAndAvailabilitysRes.data.data
          .searchPriceAndAvailabilitys.items) {
          if (itemProduct.id === itemPrice.id) {
            itemProduct["price"] = itemPrice.price;
            break;
          }
        }
      }
    }

    // console.log("ResFinal");
    // for (const item of searchProductsRes.data.data.searchProducts.items) {
    //   console.log(item);
    // }

    let merchantRes;

    if (event.origin === "merchant") {
      merchantRes = searchProductsRes.data.data.searchProducts.items.filter(
        (item) => item.hasOwnProperty("price")
      );
    }

    const priceRes = [];

    if (event.body?.minPrice && event.body?.maxPrice) {
      for (const item of searchProductsRes.data.data.searchProducts.items) {
        if (
          item?.price > event.body.minPrice &&
          item?.price < event.body.maxPrice
        ) {
          priceRes.push(item);
        }
      }
    }

    return {
      items:
        event.body?.minPrice && event.body?.maxPrice
          ? priceRes
          : event.origin === "merchant"
          ? merchantRes
          : searchProductsRes.data.data.searchProducts.items,
      total:
        event.body?.minPrice && event.body?.maxPrice
          ? priceRes.length
          : searchProductsRes.data.data.searchProducts.total,
      ProdCategory: searchProductsRes.data.data.searchProducts.ProdCategory,
      ProdFullName: searchProductsRes.data.data.searchProducts.ProdFullName,
      prodMajor: searchProductsRes.data.data.searchProducts.ProdMajor,
      prodMinor: searchProductsRes.data.data.searchProducts.ProdMinor,
      brand: searchProductsRes.data.data.searchProducts.brand,
      country: searchProductsRes.data.data.searchProducts.country,
      container: searchProductsRes.data.data.searchProducts.container,
      manufacturer: searchProductsRes.data.data.searchProducts.manufacturer,
    };
  } catch (err) {
    console.log(err);
  }
};
