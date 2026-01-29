// Sample Netlify function - test with:
//   npx netlify functions:invoke hello
//   or visit http://localhost:8888/.netlify/functions/hello

exports.handler = async (event, context) => {
  const name = event.queryStringParameters?.name || "World";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
    }),
  };
};
