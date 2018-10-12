"use strict";

/* Copyright 2018 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Servio Palacios, Cyrus, and Sam
 * REST API for IBM Food Trust (IFT) - Super Class.
 * @module src/ift/rest
 */

const axios = require("axios");
const moment = require("moment");
const _ = require("lodash");
const debug = require("debug")("trellisfw-lib-ibmfoodtrust:rest");
const config = require("./config.js");

class REST {
  constructor(param = {}) {
    let self = this;
    self._path = param.path;

    /* Format for IBM Food Trust Identifier Fields */
    /* Location */
    /* https://github.com/IBM/IFT-Developer-Zone/wiki/doc-IBMFoodTrust-ID-(identifiers) */
    /* urn:ibm:ift:location:loc:<Company Prefix>.<Location Reference> */
    self._location_prefix = "urn:ibm:ift:location:loc:7457934435.gln";

    /* oraganization id */
    self._organization_id = param.organization_id || "";
    /* IAM_TOKEN related */
    self._iam_path = "https://iam.ng.bluemix.net/oidc/token";
    self._iam_header = { "Content-Type": "application/x-www-form-urlencoded" };

    self._api_key = param.apiKey;
    self._grant_type = "urn:ibm:params:oauth:grant-type:apikey";
    self._iam_body = {
      apikey: param.apiKey,
      grant_type: "urn:ibm:params:oauth:grant-type:apikey"
    };
    self._iam_returned_url =
      "https://fs-identity-proxy-integration.mybluemix.net/exchange_token/v1/organization/" +
      self._organization_id;
    self._IAM_TOKEN = {};

    /* onboarding token related */
    /* this is the one used to interact with IFT API */
    self._onboarding_path =
      "https://fs-identity-proxy-integration.mybluemix.net/exchange_token/v1/organization/" +
      self._organization_id;
    self._onboarding_header = { "Content-Type": "application/json" };
    self._ONBOARDING_TOKEN = "";

    /* Certificates */
    self._certificates_path =
      "https://fs-certificate-management-integration.mybluemix.net/v2/certifications";
    self._certificates_point_query_path =
      "https://fs-certificate-management-integration.mybluemix.net/v2/certifications/";
    self._certificates_header = { Accept: "application/json" };

    self._certificate_template = {
      addendumsComments: "trellis-certification-test-03",
      announced: "Announced",
      auditRating: "Grade A",
      auditReferenceNumber: "dc6c0edd1b009be80fe7130cccd9b0da",
      auditScore: "NA",
      auditStartDate: "2018-07-01",
      auditType: "NA",
      auditedBy: "trellis",
      certificateReferenceNumber: "81865f679afd39ba1543244eee910b70",
      certificationStatus: "valid",
      comments: "trellis comment",
      expiryDate: "2019-01-01",
      issueDate: "2018-08-16",
      locationGLNList: ["0728612177446"],
      productHandlingIncluded: "false",
      scheme: "BRC Global Standard for Food Safety",
      schemeOwner: "BRC",
      scope: "Agents and Brokers: 01 – Raw milk and prepared foods",
      customFieldList: [
        {
          label: "NA",
          value: "http://certificateurl/",
          type: "url"
        }
      ]
    };

    Object.keys(config.certificateTemplate).map(key => {
      Object.defineProperty(self, key, {
        get: function() {
          return self._certificate_template[key];
        },
        set: function(value) {
          //debug("value", value);
          if (!value) throw new Error("Invalid " + key);
          self._certificate_template[key] = value;
        }
      });
    });

    self._certificate_delete_path_leftover = "/attachments/certificate";
  } //constructor

  /**
   * compares FSMS_observed_date and operation_observed_date
   * it takes the oldest one; then it is stored in .auditStartDate in the IFT schema
   * @param {*} first
   * @param {*} second
   */
  _compareDates(first, second) {
    let _first = first.start.substring(0, 10);
    let _second = second.start.substring(0, 10);
    return moment(_first).isAfter(_second) ? _first : _second;
  }

  /**
   * utilizes the scope from primus gfs and summarizes the most important properties
   * into one single string (stored in the .scope in the IFT schema)
   * @param {*} _scope
   */
  _getScopeDescription(_scope) {
    let productsObserved = "";
    //console.log(_scope.products_observed);
    for (var product in _scope.products_observed) {
      productsObserved += _scope.products_observed[product].name + " || ";
    }
    return _scope.description + " || " + productsObserved;
  }

  /**
   * maps the primusgfs format to IFT data model
   * @param {*} _audit primusgfs format
   * @param {*} _certificate primusgfs format
   * @param {string} [_analytics_url] - url to analytics website (optional)
   */
  _mapOada2Hyperledger(_audit, _certificate, _analytics_url) {
    let self = this;
    let gln = [];
    /* required field (*) */
    _certificate_template.addendumsComments = _audit._id;
    _certificate_template.auditStartDate = self._compareDates(
      //(*)
      _audit.conditions_during_audit.FSMS_observed_date,
      _audit.conditions_during_audit.operation_observed_date
    );
    //self._certificate_template.auditType = ""; //_audit.scheme.name + " " + _audit.scheme.version;
    self._certificate_template.auditedBy = _audit.certifying_body.auditor.name; //(*)
    self._certificate_template.certificateReferenceNumber =
      _audit.certificationid.id; //(*)
    self._certificate_template.certificationStatus = "valid";
    self._certificate_template.scheme = _audit.scheme.name; //(*)
    self._certificate_template.schemeOwner = _audit.scheme.name;
    self._certificate_template.scope = self._getScopeDescription(_audit.scope); //(*)

    if (_.get(config, "debug.overrideGLN")) {
      //(*)
      gln.push(self._location_prefix + _.get(config, "debug.overrideGLN"));
    } else {
      gln.push(
        _certificate.organization.GLN
          ? self._location_prefix + _certificate.organization.GLN
          : self._location_prefix + _audit.organization.GLN
      );
    }
    self._certificate_template.locationGLNList = gln; //(*)

    /* customFieldList */
    self._certificate_template.customFieldList[0].value = _analytics_url
      ? _analytics_url
      : self._certificate_template.customFieldList[0].value;

    return self._certificate_template;
  } //_mapOada2Hyperledger

  /**
   * retrieves the IAM Token from the HTTP response
   * it gets rid of a unused key in the object
   * @param {*} response
   */
  _getIAMTokenFromResponse(response) {
    let self = this;
    let tempToken = response;
    Object.keys(tempToken || {}).map(key => {
      if (key !== self._iam_returned_url) {
        self._IAM_TOKEN[key] = tempToken[key];
      }
    });
    debug("Received [IBM_AIM_TOKEN]");
  } //_getIAMTokenFromResponse

  /**
   * connects to the IFT frawework
   * - it generates a IAM IBM Cloud Token
   * - it exchanges tje IAM Token for an Onboarding Token
   * - all other request can use the Authorization header including the Bearer and the Onboarding Token
   */
  async connect() {
    let self = this;
    if (!self._ONBOARDING_TOKEN) {
      /* getting IBM Cloud IAM token */
      debug("[CONNECTING...]");
      return self
        .post(self._iam_path, self._iam_header, self._iam_body)
        .then(response => {
          self._getIAMTokenFromResponse(response.data);
          /* getting onboarding token */
          return self
            .post(
              self._onboarding_path,
              self._onboarding_header,
              "",
              self._IAM_TOKEN
            )
            .then(response => {
              debug("Received [ONBOARDING_TOKEN]");
              self._ONBOARDING_TOKEN = response.data;
              self._buildCertificatesHeader();
              debug("[CONNECTED]");
            })
            .catch(error => {
              debug("[ERROR] - [ONBOARDING TOKEN]", error);
              throw error;
            });
        })
        .catch(error => {
          debug("[ERROR] - [IAM TOKEN]", error);
          return null;
        });
    } else {
      debug("[ALREADY CONNECTED]");
      return "Connected";
    } //else
  } //connect

  clearToken() {
    _ONBOARDING_TOKEN = null;
  }

  /**
   * handles the case when token has expired
   * otherwise throws error
   * @param {*} error
   */
  handleHTTPError(error) {
    if (_.get(error, "response.status") == 401) {
      //User Unauthorized: Invalid token provided
      //Get a new token
      debug("ONBOARDING_TOKEN EXPIRED");
      this.clearToken();
      return this.connect();
    }
    throw error;
  }

  /**
   * GET request to IFT
   * @param {*} _path
   * @param {*} _headers
   */
  get(_path, _headers, _retries) {
    return axios({
      method: "get",
      url: _path,
      headers: _headers || ""
    }).catch(err => {
      return this.handleHTTPError(err)
        .then(() => {
          //Error was handled, retry.
          _retries = _retries == null ? 1 : _retries + 1;
          if (_retries > 3) throw err;
          debug("Error handled during GET retrying... attempt #" + _retries);
          return this.get.call(this, _path, _headers, _retries);
        })
        .catch(err => {
          debug("[GET ERROR] ->", err);
          throw err;
        });
    });
  } //get

  /**
   * deletes a certificate/document from IFT
   * @param {*} _path
   * @param {*} _headers
   */
  del(_path, _headers, _retries) {
    return axios({
      method: "delete",
      url: _path,
      headers: _headers || ""
    }).catch(err => {
      return handleHTTPError(err)
        .then(() => {
          //Error was handled, retry.
          _retries = _retries == null ? 1 : _retries + 1;
          if (_retries > 3) throw err;
          debug("Error handled during DELETE retrying... attempt #" + _retries);
          return this.del.call(this, _path, _headers, _retries);
        })
        .catch(err => {
          debug("[DELETE ERROR] ->", err);
          throw err;
        });
    });
  } //del

  /**
   * PUT request to IFT frawework
   * pre-established headers and path are defined in the class constructor
   * @param {*} path
   * @param {*} data
   */
  put(_path, _data) {
    return axios({
      method: "put",
      data: _data,
      url: _path,
      headers: opts.headers
    }).catch(err => {
      return this.handleHTTPError(err)
        .then(() => {
          //Error was handled, retry.
          _retries = _retries == null ? 1 : _retries + 1;
          if (_retries > 3) throw err;
          debug("Error handled during PUT retrying... attempt #" + _retries);
          return this.put.call(this, _path, _headers, _data, _retries);
        })
        .catch(err => {
          debug("[PUT ERROR] ->", err);
          throw err;
        });
    });
  } //put

  /**
   * post request to IFT frawework
   * pre-established headers and path are defined in the class constructor
   * @param {*} _path
   * @param {*} _headers
   * @param {*} _params
   * @param {*} _data
   */
  post(_path, _headers, _params, _data, _retries) {
    return axios({
      method: "post",
      url: _path,
      data: _data,
      params: _params,
      headers: _headers || ""
    }).catch(err => {
      return this.handleHTTPError(err)
        .then(() => {
          //Error was handled, retry.
          _retries = _retries == null ? 1 : _retries + 1;
          if (_retries > 3) throw err;
          debug("Error handled during POST retrying... attempt #" + _retries);
          return this.post.call(
            this,
            _path,
            _headers,
            _params,
            _data,
            _retries
          );
        })
        .catch(err => {
          debug("[POST ERROR] ->", err);
          throw err;
        });
    });
  } //post

  /**
   * includes the Authorization header in the IFT request
   */
  _buildCertificatesHeader() {
    this._certificates_header["Authorization"] =
      "Bearer " + this._ONBOARDING_TOKEN["onboarding_token"];
  }
} //class

/* exporting the module */
module.exports = REST;
