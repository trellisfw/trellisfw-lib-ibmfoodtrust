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
 * @author Servio Palacios
 * REST API for IBM Food Trust (IFT) - Super Class.
 * @module src/ift/rest
 */

const axios = require("axios");
const pretty = require("prettyjson");
const fs = require("fs");
const moment = require("moment");

class REST {
  constructor(param = {}) {
    let self = this;
    self._path = param.path;
    self._connected = false;
    self._onboarding_token_in_header = false;
    self._onboarding_file_name = "./onboarding_token";

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
          value: "http://serviopalacios.com/",
          type: "url"
        }
      ]
    };

    self._certificate_id = "";

    self._certificate_delete_path_leftover = "/attachments/certificate";
  } //constructor

  /**
   * compares FSMS_observed_date and operation_observed_date
   * it takes the oldest one, then it is stored in .auditStartDate in the IFT schema
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
   * maps the prmusgfs format to IFT data model
   * include the trellis resource id in the primusgfs
   * "trellis://<domain>/resources/<id>"
   * @param {*} _primusgfs
   */
  _mapOada2Hyperledger(_audit, _certificate) {
    let self = this;
    let gln = [];
    self._certificate_template.addendumsComments = _audit._id;
    self._certificate_template.auditStartDate = self._compareDates(
      _audit.conditions_during_audit.FSMS_observed_date,
      _audit.conditions_during_audit.operation_observed_date
    );
    self._certificate_template.auditedBy = _audit.certifying_body.auditor.name;
    self._certificate_template.certificateReferenceNumber =
      _audit.certificationid.id;
    self._certificate_template.certificationStatus = "valid"; 
    self._certificate_template.scheme = _audit.scheme.name;
    self._certificate_template.schemeOwner = _audit.scheme.name;
    self._certificate_template.scope = self._getScopeDescription(_audit.scope);
    gln.push(
      _certificate.organization.gln
        ? _certificate.organization.gln
        : _audit.organization.gln
    );
    self._certificate_template.locationGLNList = gln;

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
    console.log("--> [IBM_AIM_TOKEN] --> ", pretty.render(self._IAM_TOKEN));
  } //_getIAMTokenFromResponse

  /**
   * prints the onboarding token to console
   */
  _printOnboardingToken() {
    let self = this;
    console.log("[ONBOARDING_TOKEN]", pretty.render(self._ONBOARDING_TOKEN));
  }

  /**
   * reads the onboarding token from file if present
   */
  async _readOnboardingTokenFromFile() {
    let self = this;
    self._result = false;
    fs.readFile(self._onboarding_file_name, "utf8", function readFileCallback(
      err,
      data
    ) {
      if (err) {
        console.log("[Error] - [reading from file]", err);
      } else {
        self._ONBOARDING_TOKEN = JSON.parse(data);
        console.log("[ONBOARDING_TOKEN] - [EXISTS] - [reading from file]");
        self._printOnboardingToken();
        self._result = true;
      }
    });
    // console.log('reading file-->', self._result);
    return await self._result;
  } //_readOnboardingTokenFromFile

  /**
   * connects to the IFT frawework
   * - it generates a IAM IBM Cloud Token
   * - it exchanges tje IAM Token for an Onboarding Token
   * - all other request can use the Authorization header including the Bearer and the Onboarding Token
   */
  async connect() {
    let self = this;

    if (!(await self._readOnboardingTokenFromFile())) {
      /* getting IBM Cloud IAM token */
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
              self._ONBOARDING_TOKEN = response.data;
              self._connected = true;
              console.log("[CONNECTED]");
              fs.writeFile(
                self._onboarding_file_name,
                JSON.stringify(self._ONBOARDING_TOKEN),
                response => {
                  console.log("File written");
                }
              );
              //self._printOnboardingToken();
            })
            .catch(error => {
              console.log("[ERROR] - [ONBOARDING TOKEN]", error);
            });
        })
        .catch(error => {
          console.log("[ERROR] - [IAM TOKEN]", error);
          return null;
        });
    } else {
      console.log("[ALREADY CONNECTED]");
      //this._printOnboardingToken();
      self._connected = true;

      return Promise.resolve("Connected");
    } //else
  } //connect

  /**
   * GET request to IFT
   * @param {*} _path
   * @param {*} _headers
   */
  get(_path, _headers) {
    let self = this;

    return axios({
      method: "get",
      url: _path || self._path,
      headers: _headers || ""
    }).catch(err => {
      console.log("[GET ERROR] ->", err);
    });
  } //get

  /**
   * deletes a certificate/document from IFT
   * @param {*} _path
   * @param {*} _headers
   */
  del(_path, _headers) {
    return axios({
      method: "delete",
      url: _path,
      headers: _headers || ""
    }).catch(err => {
      console.log("[DELETE ERROR] ->", err);
    });
  } //del

  /**
   * PUT request to IFT frawework
   * pre-established headers and path are defined in the class constructor
   * @param {*} path
   * @param {*} data
   */
  put(_path, data) {
    let self = this;

    return axios({
      method: "put",
      data: _data,
      url: _path,
      headers: opts.headers
    }).catch(err => {
      console.log("[PUT ERROR] ->", err);
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
  post(_path, _headers, _params, _data) {
    let self = this;

    return axios({
      method: "post",
      url: _path,
      data: _data,
      params: _params,
      headers: _headers || ""
    }).catch(err => {
      console.log("[POST ERROR] ->", err);
    });
  } //post

  /**
   * includes the Authorization header in the IFT request
   */
  _buildCertificatesHeader() {
    let self = this;
    self._certificates_header = {
      Authorization: "Bearer " + self._ONBOARDING_TOKEN["onboarding_token"]
    };
    self._onboarding_token_in_header = true;
  }
} //class

/* exporting the module */
module.exports = REST;
