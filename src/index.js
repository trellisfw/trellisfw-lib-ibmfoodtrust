const primusgfs = require("./templates/primusgfs");

const _ = require("lodash");
const Promise = require("bluebird");
const IFT = require("./ift");
const config = require("./config.js");
const debug = require("debug")("trellisfw-lib-ibmfoodtrust:index");

debug("organization_id", config.ift.organization_id);
debug("apiKey", config.ift.apiKey);

let _IFT = new IFT({
  organization_id: _.get(config, "ift.organizationId"),
  apiKey: _.get(config, "ift.apiKey")
});

return _IFT
  .getCertificate("certificateid")
  .then(response => {
    //Add hyperledger_id to certification
    debug("[FETCHED]", response);
  })
  .catch(err => {
    debug("Error: Failed to getCertificate() to hyperledger.", err);
  });
