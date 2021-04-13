/**
 * This handles updating html text and event handlers for retry.html
 */

/**
 * Retrieve localized strings.
 */

var namespace = typeof browser != 'undefined' ? browser : chrome;

var sorryString1 = namespace.i18n.getMessage("sorryString1");
var sorryString2 = namespace.i18n.getMessage("sorryString2");
var changeMarketplaceString = namespace.i18n.getMessage("changeMarketplaceString");
var feedbackMessage = namespace.i18n.getMessage("feedbackMessage");
var noLuckString = namespace.i18n.getMessage("noLuckString");
var emailSubject = namespace.i18n.getMessage("emailSubject");
var emailBody1 = namespace.i18n.getMessage("emailBody1");
var emailBody2 = namespace.i18n.getMessage("emailBody2");
var emailBody3 = namespace.i18n.getMessage("emailBody3");
var emailBody4 = namespace.i18n.getMessage("emailBody4");

var newLineEscapeSeq = "%0D%0A";
var emailId = "assistantfeedback@amazon.com";

var callbacks = {};

/**
 * Map of locales based on the file available in UBPCommons
 */
var localeMap = {
    "US": 1,
    "CA": 2,
    "CN": 3,
    "JP": 4,
    "ES": 5,
    "IT": 6,
    "FR": 7,
    "DE": 8,
    "UK": 9,
    "IN": 10,
    "MX": 11,
    "BR": 12,
    "AU": 13,
    "AE": 14,
    "TR": 15
}
var defaultMarketplace = "US";
var currentStage = "prod";

/**
 * Retrieve extension logging ID that can be sent as part
 * of the feedback email by the user. This will help
 * debug any issues in the logs.
 */
var extensionLogId = "";
try {
    namespace && namespace.storage && namespace.storage.local && namespace.storage.local.get("ubpv2.extension.extensionLogId", function(result) {
        if (namespace && namespace.runtime && namespace.runtime.lastError) {
            throw new Error("Storage error while getting log Id : [" + namespace.runtime.lastError);
        }
        extensionLogId = result["ubpv2.extension.extensionLogId"];

        if (document.getElementById("logId")) {
            document.getElementById("logId").textContent = extensionLogId;
        }
    });

} catch (error) {
    // just print the error, as this failure should not hold back the extension reset.
    console.error("Failed to get value from extension storage [" + error.toString() + "]");
}

// extract query parameter from window.location
function getQueryStringValue (key) {
    return unescape(
        window.location.search.replace(
            new RegExp("^(?:.*[&\\?]" + escape(key).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
}

// Creates an ID based on a simplified UUID V4
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Builds a message to the extension given args, headers, and a callback. This is based on
 * the request builder found in UBPClient:
 * https://code.amazon.com/packages/UBPClient/blobs/mainline_2.0/--/src/ubp/client/request/RequestBuilderBase.ts
 * 
 * UBP requests generally include at least three header arguments: messageType, name, and namespace.
 * Namespace defines where the request is being sent to, name defines the API name desired, and messageType defines
 * how the API is being called, in this case as a UBP API.
 * 
 * Additional info is built and bundled into the request which is used to direct the message between processes in
 * different ways (between iframes, to a pseudo process, etc.). The most common that we use is rpcSendAndReceive
 * which will send messages through postMessage to PlatformHub, the destination process, and then back to PlatformHub
 * and finally back to the client.
 */
function buildUBPMessage(header, args, cb) {
    var id = uuid();
    if (typeof cb === "function") {
        callbacks[id] = cb;
    }
    return {
        "mType": 0,
        "source": "Gateway",
        "payload": {
            "mType": "rpcSendAndReceive",
            "msgId": id,
            "payload": {
                "data": {
                    "args": args
                },
                "header": header
            },
            "t": Date.now()
        }
    }
}

// Sends a message to fetch platform info from the extension
function getPlatformInfo(cb) {
    var message = buildUBPMessage({
        "messageType": 1, // API
        "name": "getPlatformInfo",
        "namespace": "Platform"
    }, undefined, cb);
    if (window && window.parent && window.parent.postMessage != undefined) {
        window.parent.postMessage(message, "*");
    }
}

// Sends a message to update the extension marketplace
function setLocale(locale, cb) {
    var message = buildUBPMessage({
        "extensionStage": currentStage,
        "messageType": 1, // API
        "name": "setLocale",
        "sourceProcessName": "Gateway",
        "namespace": "Platform"
    }, {
        "locale": localeMap[locale] || localeMap[defaultMarketplace]
    }, cb);
    if (window && window.parent && window.parent.postMessage != undefined) {
        window.parent.postMessage(message, "*");
    }
}

// Sends a message to the extension that reports critical path matrics during AA Home loading
function reportLoadEvent(name, cb) {
    var message = buildUBPMessage({
        "messageType": 1, // API
        "name": "reportLoadEvent",
        "sourceProcessName": "Gateway",
        "namespace": "Gateway"
    }, {
        "name": name,
        "timestamp": Date.now()
    }, cb);
    if (window && window.parent && window.parent.postMessage != undefined) {
        window.parent.postMessage(message, "*");
    }
}

// Callback for when the user changes their marketplace
function onMarketplaceDropdownUpdate() {
    reportLoadEvent("MarketplaceChange")
    var dropdown = document.getElementById("marketplaceDropdown");
    var marketplace = dropdown.value;
    setLocale(marketplace, (data) => {
        // Close the panel to prevent the user from seeing a blank white screen
        window.parent.close();
    });
}

// set error code to panic screen
var errorCode = getQueryStringValue("errorCode");
if (errorCode && document.getElementById("errorCode")) {
    document.getElementById("errorCode").textContent = "Error code: " + errorCode;
}

// Simple message handling with callbacks for postMessage
window.addEventListener("message", (event) => {
    if (event && event.data && event.data.payload) {
        var id = event.data.payload.rMsgId
        if (typeof callbacks[id] === "function") {
            callbacks[id](event.data.payload);
            delete callbacks[id];
        }
    }
});

window.addEventListener("DOMContentLoaded", function () {
    reportLoadEvent("Panic_" + errorCode);

    if (document.getElementById("sorryTextLine1") && sorryString1 && document.getElementById("sorryTextLine2") && sorryString2) {
        document.getElementById("sorryTextLine1").textContent = sorryString1;
        document.getElementById("sorryTextLine2").textContent = sorryString2;
    }

    if (document.getElementById("noLuckText") && noLuckString) {
        document.getElementById("noLuckText").textContent = noLuckString;
    }

    if (document.getElementById("marketplaceMessage") && changeMarketplaceString) {
        document.getElementById("marketplaceMessage").textContent = changeMarketplaceString;
    }

    // Send message to fetch platformInfo which will be handled by the message listener
    getPlatformInfo((data) => {
        var dropdown = document.getElementById("marketplaceDropdown");
        if (dropdown && data && data.payload) {
            currentStage = data.payload.extensionStage || "prod";
            dropdown.value = data.payload.locale || defaultMarketplace;
        }
    });

    // Set up handler for changing the marketplace dropdown
    var dropdown = document.getElementById("marketplaceDropdown");
    if (dropdown) {
        dropdown.onchange = onMarketplaceDropdownUpdate;
    }

    /**
     * Feedback button should open a mailto link using default
     * mailing client on user's machine.
     */
    if (document.getElementById("feedbackButton")) {
        if (feedbackMessage) {
            document.getElementById("feedbackButton").textContent = feedbackMessage;
        }
        document.getElementById("feedbackButton").addEventListener("click", function () {
            reportLoadEvent("SendFeedback")
            /**
             * Create email subject and body with the mailto link.
             */
            var emailBody = emailBody1 + newLineEscapeSeq+ emailBody2 +
                            newLineEscapeSeq + newLineEscapeSeq + emailBody3 +
                            newLineEscapeSeq + newLineEscapeSeq +
                            emailBody4 + extensionLogId +
                            (document.getElementById("errorCode") ?
                            newLineEscapeSeq + document.getElementById("errorCode").textContent : "");
            var mailUrl = "mailto:" + emailId + "?subject=" + emailSubject + "&body=" + emailBody;
            /**
             * ideally window.location.href should work here, but during testing
             * found out that it does not give consistent result, so using namespace.tabs.create
             * to open mailto link.
             */
            if (namespace && namespace.tabs) {
                namespace.tabs.create({url: mailUrl});
            }
        });
    }
});


