// Deprecated internal RSVP confirmation function. All logic moved external.
module.exports = async function(context){
  context.res = { status:410, body:{ ok:false, deprecated:true, message:'/api/rsvp-confirm moved to external Function App', newBase:'https://madeena-rsvp-api.azurewebsites.net/api' } };
};
