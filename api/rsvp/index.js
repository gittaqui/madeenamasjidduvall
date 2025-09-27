// Deprecated: RSVP functionality moved to external Function App.
module.exports = async function(context){
  context.res = { status:410, body:{ ok:false, deprecated:true, message:'/api/rsvp moved to external Function App', newBase:'https://madeena-rsvp-api.azurewebsites.net/api' } };
};
