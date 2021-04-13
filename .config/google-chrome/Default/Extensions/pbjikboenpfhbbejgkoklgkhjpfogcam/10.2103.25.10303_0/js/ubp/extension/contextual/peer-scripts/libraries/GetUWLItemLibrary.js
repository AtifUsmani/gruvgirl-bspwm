var GetUWLItemLibrary;
(function (GetUWLItemLibrary) {
    var GetUWLItem = (function () {
        function GetUWLItem(htmlDocument) {
            this.htmlDocument = htmlDocument;
        }
        GetUWLItem.prototype.canHandle = function (requestType) {
            return requestType === GetUWLItem.SUPPORT_REQUEST_TYPE;
        };
        GetUWLItem.prototype.handle = function () {
            try {
                var scrapper = WishlistScraper();
                var itemData = scrapper.itemData;
                return this.extractWishlistItem(itemData);
            }
            catch (error) {
                throw new Error("Wishlist Scrape failed with: " + (error.message) ? error.message : "Unknown");
            }
        };
        GetUWLItem.prototype.extractWishlistItem = function (itemData) {
            var resultItem = {
                url: "",
                asin: "",
                title: "",
                price: "",
                currency: "",
                version: "",
                bannerImage: "",
                quantity: 1,
                imageURLs: []
            };
            if (!itemData) {
                throw new Error("Scrape result is undefined!");
            }
            if (itemData.url) {
                resultItem.url = itemData.url;
            }
            else {
                resultItem.url = document.URL;
            }
            if (itemData.title) {
                resultItem.title = itemData.title;
            }
            if (itemData.asin) {
                resultItem.asin = itemData.asin;
            }
            if (itemData.price) {
                resultItem.price = domainSpecificPriceFormatter(itemData.price);
            }
            if (itemData.version) {
                resultItem.version = itemData.version;
            }
            if (itemData.bannerImage) {
                resultItem.bannerImage = itemData.bannerImage;
            }
            if (itemData.imageArray && Array.isArray(itemData.imageArray) && itemData.imageArray.length > 0) {
                var length = itemData.imageArray.length;
                for (var index = 0; index < length; index++) {
                    var image = {
                        src: null,
                        height: null,
                        width: null,
                        id: null
                    };
                    if (itemData.imageArray[index].src) {
                        image.src = itemData.imageArray[index].src;
                    }
                    if (itemData.imageArray[index].height) {
                        image.height = itemData.imageArray[index].height.toString();
                    }
                    if (itemData.imageArray[index].width) {
                        image.width = itemData.imageArray[index].width.toString();
                    }
                    if (itemData.imageArray[index].id) {
                        image.id = itemData.imageArray[index].id;
                    }
                    resultItem.imageURLs.push(image);
                }
            }
            return resultItem;
        };
        GetUWLItem.SUPPORT_REQUEST_TYPE = "UBPUWLItemGetUWLItem";
        return GetUWLItem;
    }());
    GetUWLItemLibrary.GetUWLItem = GetUWLItem;
    function domainSpecificPriceFormatter(price) {
        switch (document.location.hostname) {
            case "www.cb2.com":
                return formatCb2Price(price);
            case "oldnavy.gap.com":
                return formatOldnavyPrice(price);
            default:
                return price;
        }
    }
    function formatCb2Price(price) {
        if (!/^<span\s/.test(price.trim())) {
            return price;
        }
        var match = />\s*(?:limited time )?(\$[\d,]+\.\d{2})\s*</.exec(price);
        if (match && match[1]) {
            return match[1];
        }
        else {
            return price;
        }
    }
    function formatOldnavyPrice(price) {
        var match = /\s*(\$[\d,]+\.\d{2})\s*<*/.exec(price);
        if (match && match[1]) {
            return match[1];
        }
        else {
            return price;
        }
    }
    var WishlistScraper = function () {
        var asin;
        var bkPageVersion;
        var itemData = null;
        var pageArgs;
        var maxRequestLength = 4096;
        function isVendor() {
            return 0;
        }
        ;
        function isBKMSourceDomain() {
            var isSourceDomain;
            isSourceDomain = document.domain.match(/^(?:www\.)?amazon.(com|es|fr|co.uk|cn|co.jp|ca|it|de|in)/);
            return isSourceDomain;
        }
        ;
        function isBKMLocalDomain() {
            return document.domain.match(/^(?:www\.|.*\.)?amazon.(com|es|fr|co.uk|cn|co.jp|ca|it|de|in)/);
        }
        ;
        function isIndianAmazonDomain() {
            return document.domain.match(/^(?:www\.|.*\.)?amazon.in/);
        }
        var PageScraper = function () {
            this.itemData = {};
            this.itemData = this.getVendorItemData();
            if (!this.itemData) {
                this.itemData = this.getGenericItemData();
            }
        };
        PageScraper.prototype.getVendorItemData = function () {
            var data = null;
            var isAmazon = isBKMSourceDomain();
            if (isAmazon && !isVendor()) {
                data = this.parseAmazonVendorData();
            }
            else {
                this.bkPageVersion = document.getElementById('AUWLBkPageVersion');
                if (this.itemData && this.bkPageVersion && this.itemData.version == parseInt(this.bkPageVersion.innerHTML)) {
                    data = this.itemData;
                }
                if (!data) {
                    data = this.parseGenericVendorData();
                }
                if (!data) {
                    data = this.parseGoogleCheckoutVendorData();
                }
                if (!data && isAmazon && isVendor()) {
                    data = this.parseAmazonVendorData();
                }
            }
            return data;
        };
        PageScraper.prototype.getGenericItemData = function () {
            var itemData = { "unverified": true };
            itemData.title = this.getTitle();
            itemData.price = this.getPrice();
            itemData.imageArray = this.getGenericImageData();
            return itemData;
        };
        PageScraper.prototype.getPrice = function () {
            var startTime = new Date().getTime();
            var nodes = [];
            var nonZeroRe = /[1-9]/;
            var priceFormatRe = /((?:R?\$|USD|\u20B9|\u20A8|\&#8360\;|\&#8377\;|Rs|Rs\.|Rs\.\&nbsp\;|\&pound\;|\&\#163\;|\&\#xa3\;|\u00A3|\&yen\;|\uFFE5|\&\#165\;|\&\#xa5\;|\u00A5|eur|\&\#8364\;|\&\#x20ac\;)\s*\d[0-9\,\.]*)/gi;
            var indianCurrencyClassRe = /\b(currencyINR|rs|rupeeCurrency)\b/;
            var indianCurrentFontFamilyRe = /rupee/i;
            var indianRupeeSymbol = String.fromCharCode(8377);
            var textNodeRe = /textnode/i;
            var emRe = /em/;
            var priceRangeRe = /^(\s|to|\d|\.|\$|\-|,)+$/;
            var priceBonusRe = /club|total|price|sale|now|brightred/i;
            var outOfStockRe = /soldout|currentlyunavailable|outofstock/i;
            var tagRe = /^(h1|h2|h3|b|strong|sale)$/i;
            var anchorTagRe = /^a$/i;
            var penRe = /original|header|items|under|cart|more|nav|upsell/i;
            var last = "";
            var lastNode;
            var outOfStockIndex = -1;
            var foundPositivePriceBeforeOOSMsg = 0;
            var performOutOfStockCheck = function (domainStr) {
                var blacklist = new Array("toysrus.com", "babiesrus.com", "walmart.com");
                for (var i = 0; i < blacklist.length; i++) {
                    var regex = new RegExp("^(?:www\.)?" + blacklist[i], "i");
                    if (regex.test(domainStr)) {
                        return false;
                    }
                }
                return true;
            };
            var getParents = function (node) {
                var parents = [];
                var traverse = node;
                while (traverse.parentNode) {
                    parents.push(traverse.parentNode);
                    traverse = traverse.parentNode;
                }
                return parents;
            };
            var findMutualParent = function (first, second) {
                var firstParents = getParents(first);
                var secondParents = getParents(second);
                for (var i = 0; i < firstParents.length; i++) {
                    for (var j = 0; j < secondParents.length; j++) {
                        if (firstParents[i] === secondParents[j]) {
                            return firstParents[i];
                        }
                    }
                }
                return undefined;
            };
            var getStyleFunc = function (node, pseudoEleSelector) {
                if (pseudoEleSelector === void 0) { pseudoEleSelector = null; }
                if (document.defaultView && document.defaultView.getComputedStyle) {
                    var computedStyle = document.defaultView.getComputedStyle(node, pseudoEleSelector);
                    return function (propertyName) {
                        return computedStyle.getPropertyValue(propertyName);
                    };
                }
                else {
                    return function (propertyName) {
                        var mapper = {
                            "font-size": "fontSize",
                            "font-weight": "fontWeight",
                            "text-decoration": "textDecoration"
                        };
                        return node.currentStyle[mapper[propertyName] ? mapper[propertyName] : propertyName];
                    };
                }
            };
            var matchIndianRupee = function (node) {
                if (isIndianAmazonDomain() && node.parentNode &&
                    indianCurrencyClassRe.test(node.parentNode.childNodes[0].className)) {
                    return true;
                }
                else if (node.parentNode) {
                    var getStyle = getStyleFunc(node.parentNode, ":before");
                    if (indianCurrentFontFamilyRe.test(getStyle("font-family"))) {
                        return true;
                    }
                    if (node.parentNode.firstElementChild &&
                        indianCurrencyClassRe.test(node.parentNode.firstElementChild.className)) {
                        return true;
                    }
                    if (node.parentNode && node.parentNode.parentNode && node.parentNode.parentNode.firstElementChild) {
                        getStyle = getStyleFunc(node.parentNode.parentNode.firstElementChild);
                        if (indianCurrentFontFamilyRe.test(getStyle("font-family"))) {
                            return true;
                        }
                        if (indianCurrencyClassRe.test(node.parentNode.parentNode.firstElementChild.className)) {
                            return true;
                        }
                    }
                }
                return false;
            };
            var getWalker = function () {
                if (document.createTreeWalker) {
                    var filter = function (node) {
                        return NodeFilter.FILTER_ACCEPT;
                    };
                    return document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, filter, false);
                }
                else {
                    return {
                        q: [],
                        intialized: 0,
                        currentNode: undefined,
                        nextNode: function () {
                            if (!this.initialized) {
                                this.q.push(document.body);
                                this.initialized = true;
                            }
                            while (this.q.length) {
                                var working = this.q.pop();
                                if (working.nodeType == 3) {
                                    this.currentNode = working;
                                    return true;
                                }
                                else if (working.childNodes) {
                                    if (working.style &&
                                        (working.style.visibility == "hidden" ||
                                            working.style.display == "none")) {
                                        continue;
                                    }
                                    var children = new Array(working.childNodes.length);
                                    for (var i = 0; i < working.childNodes.length; i++) {
                                        children[i] = working.childNodes[i];
                                    }
                                    children.reverse();
                                    this.q = this.q.concat(children);
                                }
                            }
                            return false;
                        }
                    };
                }
            };
            var getFontSizePx = function (styleFunc) {
                var fontSize = styleFunc("font-size") || "";
                var sizeFactor = emRe.test(fontSize) ? 16 : 1;
                fontSize = fontSize.replace(/px|em|pt/, "");
                fontSize -= 0;
                if (!isNaN(fontSize)) {
                    return fontSize * sizeFactor;
                }
                else {
                    return 0;
                }
            };
            var getOffset = function (node) {
                var offset = node.offsetTop;
                while (node.offsetParent) {
                    node = node.offsetParent;
                    offset += node.offsetTop;
                }
                return offset;
            };
            var getScore = function (node, index) {
                var domNode = node.node;
                var styledNode = domNode.nodeType == 3 ? domNode.parentNode : domNode;
                var price = node.price;
                var content = "";
                if (domNode.nodeType == 3) {
                    content = domNode.data;
                }
                else {
                    content = domNode.innerText || domNode.textContent;
                }
                var score = 0;
                var getStyle = getStyleFunc(styledNode);
                var fontWeight = getStyle("font-weight");
                if (getStyle("font-weight") == "bold") {
                    score += 1;
                }
                if (!styledNode.offsetWidth && !styledNode.offsetHeight ||
                    getStyle("visibility") == "hidden" ||
                    getStyle("display") == "none") {
                    score -= 100;
                }
                var parentsChildrenContent = (domNode.parentNode.innerText || domNode.parentNode.textContent).replace(/\s/g, "");
                var strippedContent = content.replace(/\s+/g, "");
                if (!nonZeroRe.test(price)) {
                    score -= 100;
                }
                var strippedContentNoPrice = strippedContent.replace(/price|our/ig, "");
                if (strippedContentNoPrice.length < price.length * 2 + 4) {
                    score += 10;
                }
                if (priceRangeRe.test(strippedContent)) {
                    score += 2;
                }
                if (price.indexOf(".") != -1) {
                    score += 2;
                }
                score -= Math.abs(getOffset(styledNode) / 500);
                score += getFontSizePx(getStyle);
                if (penRe.test(content)) {
                    score -= 4;
                }
                if (priceBonusRe.test(content)) {
                    score++;
                }
                domNode = styledNode;
                var parentsWalked = 0;
                while (domNode !== null &&
                    domNode != document.body &&
                    parentsWalked++ < 4) {
                    if (parentsWalked !== 0) {
                        getStyle = getStyleFunc(domNode);
                    }
                    if (getStyle("text-decoration") == "line-through") {
                        score -= 100;
                    }
                    for (var i = 0; i < domNode.childNodes.length; i++) {
                        if (domNode.childNodes[i].nodeType == 3) {
                            var tnode = domNode.childNodes[i];
                            if (tnode.data) {
                                if (priceBonusRe.test(tnode.data)) {
                                    score += 1;
                                }
                                if (penRe.test(tnode.data)) {
                                    score -= 1;
                                }
                            }
                        }
                    }
                    if (anchorTagRe.test(domNode.tagName)) {
                        score -= 5;
                    }
                    if (priceBonusRe.test(domNode.getAttribute('class') ||
                        domNode.getAttribute('className'))) {
                        score += 1;
                    }
                    if (priceBonusRe.test(domNode.id)) {
                        score += 1;
                    }
                    if (tagRe.test(domNode.tagName)) {
                        score += 1;
                    }
                    if (penRe.test(domNode.tagName)) {
                        score -= 1;
                    }
                    if (penRe.test(domNode.id)) {
                        score -= 2;
                    }
                    if (penRe.test(domNode.getAttribute('class') ||
                        domNode.getAttribute('className'))) {
                        score -= 2;
                    }
                    domNode = domNode.parentNode;
                }
                score -= content.length / 100;
                score -= index / 5;
                return score;
            };
            var walker = getWalker();
            while (walker.nextNode() && nodes.length < 100) {
                if (nodes.length % 100 === 0) {
                    if (new Date().getTime() - startTime > 1200) {
                        return;
                    }
                }
                var node = walker.currentNode;
                var text = node.data.replace(/\s/g, "");
                priceFormatRe.lastIndex = 0;
                var priceMatch = text.match(priceFormatRe);
                if ((outOfStockIndex < 0) && outOfStockRe.test(text) && performOutOfStockCheck(document.domain)) {
                    outOfStockIndex = nodes.length;
                }
                if (priceMatch) {
                    if (priceMatch[0].match(/\.$/g) && walker.nextNode()) {
                        var nextNode = walker.currentNode;
                        if (nextNode && nextNode.data) {
                            var nextPrice = nextNode.data.replace(/\s/g, "");
                            if (nextPrice && isNaN(nextPrice)) {
                                nextPrice = "00";
                            }
                            priceMatch[0] += nextPrice;
                        }
                    }
                    else if (priceMatch[0].match(/\,$/g)) {
                        priceMatch[0] = priceMatch[0].substring(0, priceMatch[0].length - 1);
                    }
                    nodes.push({
                        "node": node,
                        "price": priceMatch[0]
                    });
                    text = "";
                }
                else if (text !== "" && matchIndianRupee(node)) {
                    nodes.push({ "node": node, "price": indianRupeeSymbol + text });
                }
                else if (last !== "" && text !== "") {
                    priceMatch = (last + text).match(priceFormatRe);
                    if (priceMatch) {
                        var mutual = findMutualParent(lastNode, node);
                        nodes.push({ "node": mutual, "price": priceMatch[0] });
                    }
                }
                lastNode = node;
                last = text;
            }
            var max = undefined;
            var maxNode = undefined;
            for (var i = 0; i < nodes.length; i++) {
                var score = getScore(nodes[i], i);
                if ((i < outOfStockIndex) && (score > 0)) {
                    foundPositivePriceBeforeOOSMsg = 1;
                }
                if (max === undefined || score > max) {
                    max = score;
                    maxNode = nodes[i];
                }
            }
            if (maxNode && ((outOfStockIndex < 0) || foundPositivePriceBeforeOOSMsg)) {
                return maxNode.price;
            }
        };
        if (RegExp("^https?://www.google.com/shopping/").test(document.URL)) {
            var demoteSrc = new RegExp("maps.googleapis.com|googleapis\.com/.*=api\|smartmaps");
            var promoteId = new RegExp("^pp-altimg-init-main$");
            PageScraper.prototype.sortImage = function (a, b) {
                return (Number(promoteId.test(b.id)) - Number(promoteId.test(a.id))) || (Number(demoteSrc.test(a.src)) - Number(demoteSrc.test(b.src))) || Number(b.height * b.width) - Number(a.height * a.width);
            };
        }
        else {
            PageScraper.prototype.sortImage = function (a, b) {
                return (b.height * b.width) - (a.height * a.width);
            };
        }
        PageScraper.prototype.getGenericImageData = function (includeSrc) {
            var imgs = document.getElementsByTagName('img');
            var imageArray = [];
            var srcs = {};
            for (var i = 0; i < imgs.length; i++) {
                var img = imgs[i];
                var imageSrc = img.src;
                if (img.src.length < 7 && img.srcset.length >= 7) {
                    if (typeof img.currentSrc === 'undefined') {
                        continue;
                    }
                    else {
                        imageSrc = img.currentSrc;
                    }
                }
                if (imageSrc.length > maxRequestLength) {
                    continue;
                }
                if (typeof img.naturalWidth != 'undefined' && img.naturalWidth == 0 || !img.complete) {
                    continue;
                }
                if (srcs[imageSrc]) {
                    continue;
                }
                var pixelCount = img.height * img.width;
                var squareness = 1;
                if (img.id && img.id == '__uwl_img_copy__') {
                    continue;
                }
                if (img.id && img.id == 'uwl_logo') {
                    continue;
                }
                if (img.height > img.width && img.height > 0) {
                    squareness = img.width / img.height;
                }
                else if (img.width > img.height && img.width > 0) {
                    squareness = img.height / img.width;
                }
                if (pixelCount > 1000 && squareness > 0.5
                    || (includeSrc && imageSrc == includeSrc)) {
                    var imageIndex = imageArray.length;
                    imageArray[imageIndex] = {};
                    imageArray[imageIndex].src = imageSrc;
                    imageArray[imageIndex].height = img.height;
                    imageArray[imageIndex].width = img.width;
                    imageArray[imageIndex].id = img.id;
                    srcs[imageSrc] = 1;
                }
            }
            var sortFunc = function (a, b) {
                if (includeSrc) {
                    if (a.src == includeSrc && b.src != includeSrc) {
                        return -1;
                    }
                    if (a.src != includeSrc && b.src == includeSrc) {
                        return 1;
                    }
                }
                return PageScraper.prototype.sortImage(a, b);
            };
            imageArray.sort(sortFunc);
            try {
                var imgIterator = document.evaluate('//*[@itemtype="http://schema.org/Product"]//img[@itemprop="image"]', document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
                if (!imgIterator) {
                    return imageArray;
                }
                var currentImg = imgIterator.iterateNext();
                var schemaOrgImgArray = [];
                while (currentImg) {
                    schemaOrgImgArray.push({
                        src: currentImg.src,
                        height: currentImg.height,
                        width: currentImg.width,
                        id: currentImg.id
                    });
                    currentImg = imgIterator.iterateNext();
                }
                Array.prototype.unshift.apply(imageArray, schemaOrgImgArray);
            }
            catch (e) {
            }
            return imageArray;
        };
        PageScraper.prototype.getElementsByClassName = function (className, elem) {
            elem = elem || document;
            var matches = [];
            if (document.getElementsByClassName) {
                try {
                    var elems = elem.getElementsByClassName(className);
                    for (var i = 0; i < elems.length; i++) {
                        matches.push(elems[i]);
                    }
                }
                catch (err) {
                    matches = this.getElementsByClassNameFallback(className, elem);
                }
                return matches;
            }
            else if (document.evaluate) {
                var node;
                var elems = document.evaluate(".//*[contains(concat(' ', @class, ' '),' " + className + " ')]", elem, null, 0, null);
                while (node = elems.iterateNext()) {
                    matches.push(node);
                }
                return matches;
            }
            else {
                matches = this.getElementsByClassNameFallback(className, elem);
                return matches;
            }
        };
        PageScraper.prototype.getElementsByClassNameFallback = function (className, elem) {
            var matches = [], elems = elem.getElementsByTagName("*"), regex = new RegExp("(^|\\s)" + className + "(\\s|$)");
            for (var i = 0; i < elems.length; i++) {
                if (regex.test(elems[i].className)) {
                    matches.push(elems[i]);
                }
            }
            return matches;
        };
        PageScraper.prototype.extractValue = function (elem) {
            if (elem.nodeName == "IMG" || elem.nodeName == "IFRAME") {
                return elem.src;
            }
            else if (elem.nodeName == "INPUT") {
                return elem.value;
            }
            return elem.innerHTML;
        };
        PageScraper.prototype.parseGenericVendorData = function () {
            var postfix = '';
            if (pageArgs && pageArgs.name) {
                postfix = '.' + pageArgs.name;
            }
            var _object = null;
            var obj = function () {
                if (_object) {
                    return _object;
                }
                _object = new Object();
                return _object;
            };
            var bkHide = document.getElementById('AUWLBkHide' + postfix);
            if (bkHide && bkHide.innerHTML && bkHide.innerHTML.length && isBKMLocalDomain()) {
                obj().hide = bkHide.innerHTML;
            }
            var bkTitle = document.getElementById('AUWLBkTitle' + postfix);
            if (bkTitle) {
                obj().title = bkTitle.innerHTML;
            }
            var bkPrice = document.getElementById('AUWLBkPrice' + postfix);
            var bkPriceLow = document.getElementById('AUWLBkPriceLow' + postfix);
            var bkPriceHigh = document.getElementById('AUWLBkPriceHigh' + postfix);
            var bkCurrency = document.getElementById('AUWLBkCurrency' + postfix);
            if (bkPrice && bkPrice.innerHTML && bkPrice.innerHTML.length) {
                obj().price = bkPrice.innerHTML;
            }
            else if (bkPriceLow && bkPriceLow.innerHTML && bkPriceLow.innerHTML.length
                && bkPriceHigh && bkPriceHigh.innerHTML && bkPriceHigh.innerHTML.length) {
                obj().price = bkPriceLow.innerHTML;
            }
            if (bkCurrency && bkCurrency.innerHTML && bkCurrency.innerHTML.length) {
                obj().currency = bkCurrency.innerHTML;
            }
            var bkImage = document.getElementById('AUWLBkImage' + postfix);
            if (bkImage) {
                obj().imageArray = [{
                        "src": bkImage.innerHTML
                    }];
            }
            var bkURL = document.getElementById('AUWLBkURL' + postfix);
            if (bkURL) {
                obj().url = bkURL.innerHTML;
            }
            if (bkPageVersion) {
                var version = parseInt(bkPageVersion.innerHTML);
                obj().version = version;
            }
            var bkBannerImage = document.getElementById('AUWLBkBannerImage' + postfix);
            var isAmazon = isBKMSourceDomain();
            if (bkBannerImage && isAmazon) {
                obj().bannerImage = bkBannerImage.innerHTML;
            }
            return _object;
        };
        PageScraper.prototype.parseAmazonVendorData = function () {
            var itemData = new Object();
            try {
                itemData.title = document.title;
                if (typeof itemData.title != "string") {
                    itemData.title = "";
                }
                try {
                    var titleBlock = document.getElementById('btAsinTitle');
                    if (titleBlock) {
                        itemData.title = titleBlock.innerText || titleBlock.textContent;
                        if (itemData.title) {
                            itemData.title = itemData.title.replace(/^\s+|\s+$/g, "");
                        }
                    }
                }
                catch (e) { }
                try {
                    itemData.asin = document.handleBuy.ASIN.value;
                }
                catch (e) {
                    try {
                        var asinFieldNames = { ASIN: 1, asin: 1, o_asin: 1 };
                        asinFieldNames['ASIN.0'] = 1;
                        for (var asinField in asinFieldNames) {
                            var asins = document.getElementsByName(asinField);
                            if (asins.length) {
                                itemData.asin = asins[0].value;
                                break;
                            }
                        }
                    }
                    catch (e) { }
                }
                var checkTags = new Array("b", "span");
                if (document.evaluate) {
                    for (var i = 0; i < checkTags.length; i++) {
                        var elts = document.evaluate("//div[@id='priceBlock']//table[@class='product']//td//" + checkTags[i] + "[contains(@class,'priceLarge') or contains(@class,'price') or contains(@class,'pa_price')]", document, null, 5, null);
                        var elt = null;
                        while (elt = elts.iterateNext()) {
                            if (elt.textContent) {
                                itemData.price = elt.textContent;
                                break;
                            }
                        }
                        if (itemData.price)
                            break;
                    }
                }
                else {
                    var priceBlock = document.getElementById('priceBlock');
                    if (priceBlock) {
                        var tables = priceBlock.getElementsByTagName('table');
                        for (var i = 0; i < tables.length; i++) {
                            var tableClass = tables[i].getAttribute('class') || tables[i].getAttribute('className');
                            if (tableClass == 'product') {
                                for (var j = 0; i < checkTags.length; j++) {
                                    var elements = tables[i].getElementsByTagName(checkTags[j]);
                                    for (var i = 0; i < elements.length; i++) {
                                        var elementClass = elements[i].getAttribute('class') || elements[i].getAttribute('className');
                                        if (elementClass.indexOf('price') > -1 || elementClass.indexOf('priceLarge') > -1 || elementClass.indexOf('pa_price') > -1) {
                                            itemData.price = elements[i].innerHTML;
                                            break;
                                        }
                                    }
                                    if (itemData.price)
                                        break;
                                }
                            }
                        }
                    }
                }
                if (itemData && itemData.price) {
                    var priceParts = itemData.price.split("-");
                    if (priceParts[0]) {
                        itemData.price = priceParts[0];
                    }
                }
                if (itemData && !itemData.price) {
                    itemData.price = this.getPrice();
                }
                var imageCellNames = { prodImageCell: 1, fiona_intro_noflash: 1, productheader: 1, 'kib-ma-container-1': 1, 'center-12_feature_div': 1, holderMainImage: 1, 'main-image-outer-wrapper': 1, 'main-image-container': 1 };
                var selectedImage;
                for (var imageCell in imageCellNames) {
                    var prodImageCell = document.getElementById(imageCell);
                    if (prodImageCell) {
                        var prodImages = prodImageCell.getElementsByTagName('img');
                        if (prodImages.length) {
                            var prodImageArray = new Array(prodImages.length);
                            for (var i = 0; i < prodImages.length; i++) {
                                prodImageArray.push(prodImages[i]);
                            }
                            prodImageArray.sort(this.sortImage);
                            selectedImage = prodImageArray[0];
                            break;
                        }
                    }
                }
                if (selectedImage) {
                    itemData.imageArray = [{
                            "src": selectedImage.src,
                            "height": selectedImage.height,
                            "width": selectedImage.width
                        }];
                }
                else {
                    if (itemData && !itemData.asin) {
                        itemData.imageArray = this.getGenericImageData();
                    }
                }
            }
            catch (e) { }
            if (!itemData.imageArray) {
                itemData.imageArray = [];
            }
            return itemData;
        };
        PageScraper.prototype.parseGoogleCheckoutVendorData = function () {
            var itemData = null;
            var elems = this.getElementsByClassName("product");
            if (elems && elems[0]) {
                itemData = {};
                itemData.unverified = true;
                var prod = elems[0];
                var scrapedImage;
                var titleElem = this.getElementsByClassName("product-title", prod);
                if (titleElem && titleElem[0]) {
                    itemData.title = this.extractValue(titleElem[0]);
                }
                var priceElem = this.getElementsByClassName("product-price", prod);
                if (priceElem && priceElem[0]) {
                    itemData.price = this.extractValue(priceElem[0]);
                }
                var urlElem = this.getElementsByClassName("product-url", prod);
                if (urlElem && urlElem[0]) {
                    itemData.url = this.extractValue(urlElem[0]);
                }
                var imgElem = this.getElementsByClassName("product-image", prod);
                if (imgElem && imgElem[0]) {
                    var imgSrc = this.extractValue(imgElem[0]);
                    scrapedImage = imgSrc;
                }
                itemData.imageArray = this.getGenericImageData(scrapedImage);
            }
            if (itemData && itemData.title && itemData.price) {
                return itemData;
            }
            else {
                return null;
            }
        };
        PageScraper.prototype.getTitle = function () {
            var title = document.title;
            if (typeof title != "string") {
                return "";
            }
            title = title.replace(/\s+/g, ' ');
            title = title.replace(/^\s*|\s*$/g, '');
            if (document.domain.match(/amazon\.com/) && asin) {
                var titleParts = title.split(":");
                if (titleParts[1]) {
                    title = titleParts[1];
                }
            }
            return title;
        };
        return new PageScraper();
    };
})(GetUWLItemLibrary || (GetUWLItemLibrary = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2V0VVdMSXRlbUxpYnJhcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvdWJwL2V4dGVuc2lvbi9jb250ZXh0dWFsL3BlZXItc2NyaXB0cy9saWJyYXJpZXMvR2V0VVdMSXRlbUxpYnJhcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsSUFBVSxpQkFBaUIsQ0ErbEMxQjtBQS9sQ0QsV0FBVSxpQkFBaUI7SUF3QnZCO1FBTUksb0JBQW9CLFlBQXFCO1lBQXJCLGlCQUFZLEdBQVosWUFBWSxDQUFTO1FBQ3pDLENBQUM7UUFRRCw4QkFBUyxHQUFULFVBQVUsV0FBa0I7WUFDeEIsT0FBTyxXQUFXLEtBQUssVUFBVSxDQUFDLG9CQUFvQixDQUFDO1FBQzNELENBQUM7UUFNRCwyQkFBTSxHQUFOO1lBQ0ksSUFBSTtnQkFDQSxJQUFJLFFBQVEsR0FBRyxlQUFlLEVBQUUsQ0FBQztnQkFDakMsSUFBSSxRQUFRLEdBQVksUUFBUSxDQUFDLFFBQVEsQ0FBQztnQkFDMUMsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDN0M7WUFBQyxPQUFPLEtBQUssRUFBRTtnQkFDWixNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFBLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNqRztRQUNMLENBQUM7UUFFRCx3Q0FBbUIsR0FBbkIsVUFBb0IsUUFBWTtZQUM1QixJQUFJLFVBQVUsR0FBaUI7Z0JBQzNCLEdBQUcsRUFBRSxFQUFFO2dCQUNQLElBQUksRUFBRSxFQUFFO2dCQUNSLEtBQUssRUFBRSxFQUFFO2dCQUNULEtBQUssRUFBRSxFQUFFO2dCQUNULFFBQVEsRUFBRSxFQUFFO2dCQUNaLE9BQU8sRUFBRSxFQUFFO2dCQUNYLFdBQVcsRUFBRSxFQUFF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cmNlc0NvbnRlbnQiOlsibmFtZXNwYWNlIEdldFVXTEl0ZW1MaWJyYXJ5IHtcbiAgICBkZWNsYXJlIHZhciBYUGF0aFJlc3VsdDphbnk7XG4gICAgLyoqXG4gICAgICogQSBjb21wb25lbnQgdGhhdCBnZXQgVVdMIHdpc2hsaXN0IGl0ZW0gZnJvbSBhbiBIVE1MRG9jdW1lbnQuIEFsbCB0aGUgbG9naWMgaXMgcG9ydGluZyBmcm9tOlxuICAgICAqICAgaHR0cHM6Ly9jb2RlLmFtYXpvbi5jb20vcGFja2FnZXMvQklUQXBwbGljYXRpb25zL2Jsb2JzLzQ2NDIyM2MwZmRiODliYjgxMjU2NzVlNThjYjdmNzA4NDk3YmE1NDYvLS0vbWFzb24vcmV0YWlsL2dwL2JpdC93aXNobGlzdC90ZW1wb3Jhcnlfc2NyYXBlci5taT9obF9saW5lcz01MC01MCUyQzUwLTUwI2xpbmUtNDdcbiAgICAgKiAgIGh0dHBzOi8vY29kZS5hbWF6b24uY29tL3BhY2thZ2VzL0FtYXpvbkZhbWlseVdpc2hsaXN0QXBwbGljYXRpb25NYXNvbi9ibG9icy9tYWlubGluZS8tLS9tYXNvbi9hbWF6b24tZmFtaWx5L2dwL3dpc2hsaXN0L2Jvb2ttYXJrbGV0L2dldC1wcmljZS5taVxuICAgICAqXG4gICAgICogQSBHZXRVV0xJdGVtIGlzIHVzZWQgaW4gdGhlIGZvbGxvd2luZyBtYW5uZXI6XG4gICAgICpcbiAgICAgKiA8Y29kZT5cbiAgICAgKiAvLyBjcmVhdGUgYSBHZXRVV0xJdGVtIGluc3RhbmNlXG4gICAgICogR2V0VVdMSXRlbSBpdGVtR2V0dGVyID0gbmV3IEdldFVXTEl0ZW1MaWJyYXJ5LkdldFVXTEl0ZW0oKTtcbiAgICAgKlxuICAgICAqICAvLyBwZXJmb3JtIHRoZSBnZXQgaXRlbSAtIG5vdGljZSB0aGF0IHRoZSBIVE1MRG9jdW1lbnQgaXMgc3BlY2lmaWVkIGFzIHRoZSBvbmx5IHBhcmFtZXRlclxuICAgICAqICB2YXIgaXRlbSA9IGl0ZW1HZXR0ZXIuZ2V0VVdMSXRlbSh3aW5kb3cuZG9jdW1lbnQpO1xuICAgICAqIDwvY29kZT5cbiAgICAgKlxuICAgICAqIFhYWDogcGVlciBzY3JpcHRzIGNhbm5vdCB1c2UgdGhlIG1vZHVsZSBsb2FkZXIgYXMgdGhleSBhcmUgdG8gYmUgaW5qZWN0ZWRcbiAgICAgKiBvbnRvIHRoZSBwYWdlIGRpcmVjdGx5IGFuZCB0aHVzIG5lZWQgdG8gbGlnaHQtd2VpZ2h0LlxuICAgICAqXG4gICAgICogWFhYLTI6IFRoaXMgbGlicmFyeSBuZWVkcyB0byBiZSBpbmplY3RlZCBvbnRvIHRoZSBwYWdlIGJlZm9yZSBHZXRVV0xJdGVtRHJpdmVyXG4gICAgICogYXMgdGhlIGRyaXZlciBuZWVkcyB0aGUgbGlicmFyeSBiZWZvcmUgYm9vdHN0cmFwcGluZyBidXQgdGhlcmUgaXMgbm9cbiAgICAgKiBtb2R1bGUgbG9hZGVyIGF2YWlsYWJsZSBpbiBjb250ZW50IHNjcmlwdCBjb250ZXh0XG4gICAgICovXG4gICAgZXhwb3J0IGNsYXNzIEdldFVXTEl0ZW0gaW1wbGVtZW50cyBJQ29udGV4dHVhbFBlZXJMaWJyYXJ5IHtcbiAgICAgICAgcHJpdmF0ZSBzdGF0aWMgU1VQUE9SVF9SRVFVRVNUX1RZUEU6c3RyaW5nID0gXCJVQlBVV0xJdGVtR2V0VVdMSXRlbVwiO1xuICAgICAgICAvKipcbiAgICAgICAgICogSW5pdGlhbGl6ZSB3aXRoIHRoZSBnaXZlbiBIVE1MRG9jdW1lbnRcbiAgICAgICAgICogQHBhcmFtIGh0bWxEb2N1bWVudFxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IocHJpdmF0ZSBodG1sRG9jdW1lbnQ6RG9jdW1lbnQpIHtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJbXBsZW1lbnQge0BsaW5rIElDb250ZXh0dWFsUGVlckxpYnJhcnl9IHRvIHJlc3BvbmQgdG9cbiAgICAgICAgICogb25seSBVQlBVV0xJdGVtR2V0VVdMSXRlbSByZXF1ZXN0c1xuICAgICAgICAgKiBAcGFyYW0gcmVxdWVzdFxuICAgICAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIGNhbkhhbmRsZShyZXF1ZXN0VHlwZTpzdHJpbmcpOmJvb2xlYW4ge1xuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3RUeXBlID09PSBHZXRVV0xJdGVtLlNVUFBPUlRfUkVRVUVTVF9UWVBFO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEF0dGVtcHRzIHRvIGdldCBVV0wgaXRlbSBmcm9tIHRoZSBzcGVjaWZpZWQgSFRNTERvY3VtZW50XG4gICAgICAgICAqIEByZXR1cm5zIHtJV2lzaGxpc3RJdGVtfVxuICAgICAgICAgKi9cbiAgICAgICAgaGFuZGxlKCk6SVdpc2hsaXN0SXRlbSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHZhciBzY3JhcHBlciA9IFdpc2hsaXN0U2NyYXBlcigpO1xuICAgICAgICAgICAgICAgIHZhciBpdGVtRGF0YTphbnkgPSA8YW55PnNjcmFwcGVyLml0ZW1EYXRhO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmV4dHJhY3RXaXNobGlzdEl0ZW0oaXRlbURhdGEpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJXaXNobGlzdCBTY3JhcGUgZmFpbGVkIHdpdGg6IFwiICsgKGVycm9yLm1lc3NhZ2UpPyBlcnJvci5tZXNzYWdlIDogXCJVbmtub3duXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZXh0cmFjdFdpc2hsaXN0SXRlbShpdGVtRGF0YTphbnkpOklXaXNobGlzdEl0ZW0ge1xuICAgICAgICAgICAgdmFyIHJlc3VsdEl0ZW06SVdpc2hsaXN0SXRlbSA9IHtcbiAgICAgICAgICAgICAgICB1cmw6IFwiXCIsXG4gICAgICAgICAgICAgICAgYXNpbjogXCJcIixcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJcIixcbiAgICAgICAgICAgICAgICBwcmljZTogXCJcIixcbiAgICAgICAgICAgICAgICBjdXJyZW5jeTogXCJcIixcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiBcIlwiLFxuICAgICAgICAgICAgICAgIGJhbm5lckltYWdlOiBcIlwiLFxuICAgICAgICAgICAgICAgIHF1YW50aXR5OiAxLFxuICAgICAgICAgICAgICAgIGltYWdlVVJMczogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoIWl0ZW1EYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU2NyYXBlIHJlc3VsdCBpcyB1bmRlZmluZWQhXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGl0ZW1EYXRhLnVybCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdEl0ZW0udXJsID0gaXRlbURhdGEudXJsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHRJdGVtLnVybCA9IGRvY3VtZW50LlVSTDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpdGVtRGF0YS50aXRsZSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdEl0ZW0udGl0bGUgPSBpdGVtRGF0YS50aXRsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpdGVtRGF0YS5hc2luKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0SXRlbS5hc2luID0gaXRlbURhdGEuYXNpbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpdGVtRGF0YS5wcmljZSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdEl0ZW0ucHJpY2UgPSBkb21haW5TcGVjaWZpY1ByaWNlRm9ybWF0dGVyKGl0ZW1EYXRhLnByaWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpdGVtRGF0YS52ZXJzaW9uKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0SXRlbS52ZXJzaW9uID0gaXRlbURhdGEudmVyc2lvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpdGVtRGF0YS5iYW5uZXJJbWFnZSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdEl0ZW0uYmFubmVySW1hZ2UgPSBpdGVtRGF0YS5iYW5uZXJJbWFnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpdGVtRGF0YS5pbWFnZUFycmF5ICYmIEFycmF5LmlzQXJyYXkoaXRlbURhdGEuaW1hZ2VBcnJheSkgJiYgaXRlbURhdGEuaW1hZ2VBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxlbmd0aDpudW1iZXI9aXRlbURhdGEuaW1hZ2VBcnJheS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaW5kZXg6bnVtYmVyPTA7IGluZGV4PGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW1hZ2U6SVByb2R1Y3RJbWFnZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYzogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IG51bGxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW1EYXRhLmltYWdlQXJyYXlbaW5kZXhdLnNyYykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2Uuc3JjICAgID0gaXRlbURhdGEuaW1hZ2VBcnJheVtpbmRleF0uc3JjO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChpdGVtRGF0YS5pbWFnZUFycmF5W2luZGV4XS5oZWlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGltYWdlLmhlaWdodCA9IGl0ZW1EYXRhLmltYWdlQXJyYXlbaW5kZXhdLmhlaWdodC50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChpdGVtRGF0YS5pbWFnZUFycmF5W2luZGV4XS53aWR0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2Uud2lkdGggID0gaXRlbURhdGEuaW1hZ2VBcnJheVtpbmRleF0ud2lkdGgudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbURhdGEuaW1hZ2VBcnJheVtpbmRleF0uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGltYWdlLmlkICAgID0gaXRlbURhdGEuaW1hZ2VBcnJheVtpbmRleF0uaWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0SXRlbS5pbWFnZVVSTHMucHVzaChpbWFnZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdEl0ZW07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEb21haW4tc3BlY2lmaWMgcHJpY2UgZm9ybWF0dGVyIGZ1bmN0aW9uIGZvciBtb2RpZnlpbmcgYW55IHByaWNlIHN0cmluZ3MgcG9zdC1zY3JhcGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBwcmljZVxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICovXG4gICAgZnVuY3Rpb24gZG9tYWluU3BlY2lmaWNQcmljZUZvcm1hdHRlciAocHJpY2U6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIHN3aXRjaCAoZG9jdW1lbnQubG9jYXRpb24uaG9zdG5hbWUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJ3d3cuY2IyLmNvbVwiOlxuICAgICAgICAgICAgICAgIHJldHVybiBmb3JtYXRDYjJQcmljZShwcmljZSk7XG4gICAgICAgICAgICBjYXNlIFwib2xkbmF2eS5nYXAuY29tXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcm1hdE9sZG5hdnlQcmljZShwcmljZSk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHJldHVybiBwcmljZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZvcm1hdHMgcHJpY2VzIGZyb20gY2IyLmNvbVxuICAgICAqXG4gICAgICogQHBhcmFtIHByaWNlXG4gICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmb3JtYXRDYjJQcmljZShwcmljZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgLy8gRGV0ZWN0IGlmIG91ciBwcmljZSBzdGFydHMgd2l0aCBhIHNwYW47IGlmIG5vdCwgcmV0dXJuIHByaWNlIGFzLWlzLiBUaGUgY3VycmVudCBjYXNlIHdlJ3JlIGFkZHJlc3NpbmcgaXMgZm9yIHNwYW4tYW5ub3RhdGVkIHByaWNlcy5cbiAgICAgICAgaWYgKCEvXjxzcGFuXFxzLy50ZXN0KHByaWNlLnRyaW0oKSkpIHsgIC8vIHVzZXMgcmVnZXhwIGluc3RlYWQgb2YgaW5kZXhPZiBmb3IgdGhlIHdoaXRlc3BhY2UgbWF0Y2hcbiAgICAgICAgICAgIHJldHVybiBwcmljZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBGb3IgdGhpcyBmaXgsIHdlJ2xsIGp1c3Qgc2ltcGx5IGxvb2sgZm9yIHRoZSBmaXJzdCBwcmljZSB3ZSBjYW4gZmluZCwgYW5kIHJldHVybiBpdFxuICAgICAgICAvLyBSZWdleHAgYmVsb3cgZXhwbGFpbmVkOiBsb29rcyBmb3IgYW4gZW5kIHRhZyAnPicsIDAgb3IgbW9yZSB3aGl0ZXNwYWNlIGNoYXJzLCAkIHN5bWJvbCwgMSBvciBtb3JlIGRvbGxhcnMsIHRoZW4gMiBjZW50cyBjaGFycy4gV2UgYXNzdW1lXG4gICAgICAgIC8vIGRvbGxhcnMoJCkgc2luY2UgQ0IyIGlzIGEgVVMtYmFzZWQgcmV0YWlsZXIsIGFuZCB0aGlzIGZ1bmN0aW9uIGlzIENCMiBzcGVjaWZpYy4gSSd2ZSBhbHNvIHZlcmlmaWVkIHRoYXQgZm9yIGl0ZW1zIHVuZGVyIGEgJDEgdGhleSB1c2UgYSAwIHByZWZpeFxuICAgICAgICAvLyBpLmUuICQwLjk5IHdoaWNoIHRoaXMgcmVnZXhwIG1hdGNoZXMuIFdlIGFsc28gb3B0aW9uYWxseSBjaGVjayBmb3IgdGhlIHN0cmluZyAnbGltaXRlZCB0aW1lICcsIHNpbmNlIHRoYXQgc29tZXRpbWVzIGFjY29tcGFuaWVzIHRoZSBwcmljZSBzdHJpbmdcbiAgICAgICAgLy8gYXMgd2VsbC5cbiAgICAgICAgLy8gZXhhbXBsZSBpbnB1dDogPHNwYW4gY2xhc3M9XCJzYWxlXCI+PHNwYW4gY2xhc3M9XCJzYWxlUHJpY2VcIj4gJDE3Ljk1PC9zcGFuPjxzcGFuIGNsYXNzPVwicmVnUHJpY2VcIj4gcmVnLiAgJDIwLjAwPC9zcGFuPjwvc3Bhbj5cbiAgICAgICAgLy8gZXhwZWN0ZWQgb3V0cHV0OiAkMTcuOTVcbiAgICAgICAgLy8gZXhhbXBsZSBpbnB1dCAyOiA8c3BhbiBjbGFzcz1cInNhbGVcIj48c3BhbiBjbGFzcz1cInNhbGVQcmljZVwiPmxpbWl0ZWQgdGltZSAkMTcuOTU8L3NwYW4+PHNwYW4gY2xhc3M9XCJyZWdQcmljZVwiPiByZWcuICAkMjAuMDA8L3NwYW4+PC9zcGFuPlxuICAgICAgICAvLyBleHBlY3RlZCBvdXRwdXQgMjogJDE3Ljk1XG4gICAgICAgIHZhciBtYXRjaCA9IC8+XFxzKig/OmxpbWl0ZWQgdGltZSApPyhcXCRbXFxkLF0rXFwuXFxkezJ9KVxccyo8Ly5leGVjKHByaWNlKTtcbiAgICAgICAgLy8gcmV0dXJuIHRoZSBmaXJzdCAoYW5kIG9ubHkpIGNhcHR1cmUgZ3JvdXAgdGhhdCBjb250YWlucyB0aGUgY29ycmVjdGx5IGZvcm1hdHRlZC9leHRyYWN0ZWQgcHJpY2UsIG9yICdwcmljZScgaWYgbm90aGluZyBtYXRjaGVkXG4gICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaFsxXSkge1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoWzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHByaWNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9ybWF0cyBwcmljZXMgZnJvbSBvbGRuYXZ5LmdhcC5jb20uIE5vdGUsIHd3dy5nYXAuY29tIGRvZXNuJ3QgaGF2ZSB0aGlzIGlzc3VlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHByaWNlXG4gICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBmb3JtYXRPbGRuYXZ5UHJpY2UocHJpY2U6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIC8vIE1hdGNoIHRoZSBmaXJzdCBwcmljZSB3ZSBjYW4gZmluZCBhbmQgcmV0dXJuIGl0LlxuICAgICAgICB2YXIgbWF0Y2ggPSAvXFxzKihcXCRbXFxkLF0rXFwuXFxkezJ9KVxccyo8Ki8uZXhlYyhwcmljZSk7XG5cbiAgICAgICAgLy8gcmV0dXJuIHRoZSBmaXJzdCAoYW5kIG9ubHkpIGNhcHR1cmUgZ3JvdXAgdGhhdCBjb250YWlucyB0aGUgY29ycmVjdGx5IGZvcm1hdHRlZC9leHRyYWN0ZWQgcHJpY2UsIG9yICdwcmljZScgaWYgbm90aGluZyBtYXRjaGVkXG4gICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaFsxXSkge1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoWzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHByaWNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBUaGUgYWdncmVnYXRpb24ganMgb2YgdGVtcG9yYXJ5X3NjcmFwZXIubWkgYW5kIGdldC1wcmljZS5taSB3aGljaCB3aWxsIGJlXG4gICAgICogaW5qZWN0ZWQgYXMgY29udGVjdCBzY3JpcHQuXG4gICAgICogV2UgcmVtb3ZlZCBhbG1vc3QgYWxsIGNvZGUgaW4gaHR0cHM6Ly9jb2RlLmFtYXpvbi5jb20vcGFja2FnZXMvQklUQXBwbGljYXRpb25zL2Jsb2JzL2hlYWRzL21haW5saW5lLy0tL21hc29uL3JldGFpbC9ncC9iaXQvd2lzaGxpc3Qvd2lzaGxpc3RTY3JhcGVyLmpzXG4gICAgICogdG8gbWFrZSBpdCB0byBhIGxpYnJhcnksIHNvIHdlIGNhbiBjYWxsIGl0IGZyb20gVUJQIHBsYXRmb3JtIGFuZCByZXR1cm4gcmVzdWx0LCBubyBuZWVkIHRvIHBvc3QgbWVzc2FnZSBmcm9tIHBhZ2UuXG4gICAgICovXG4gICAgdmFyIFdpc2hsaXN0U2NyYXBlciA9IGZ1bmN0aW9uKCkge1xuXG4gICAgLypcbiAgICAgKiBCSVQgY2hhbmdlczogdGhlc2UgdmFyaWFibGVzIGFyZSBkZWZpbmVkIGluIGNhbGxlciBjb250ZXh0LCB3aWxsIGJlIHVzZWQgaGVyZS4gR2V0IHNjcmlwdCBmcm9tXG4gICAgICogaHR0cDovL3d3dy5hbWF6b24uY29tL2dwL2JpdC93aXNobGlzdC93aXNobGlzdFNjcmFwZXIuanMgd2lsbCBzZWUgdGhlc2UgdmFyaWFibGVzLlxuICAgICAqL1xuICAgIHZhciBhc2luO1xuICAgIHZhciBia1BhZ2VWZXJzaW9uO1xuICAgIHZhciBpdGVtRGF0YSA9IG51bGw7XG4gICAgdmFyIHBhZ2VBcmdzO1xuICAgIHZhciBtYXhSZXF1ZXN0TGVuZ3RoID0gNDA5NjtcblxuICAgIGZ1bmN0aW9uIGlzVmVuZG9yKCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGlzQktNU291cmNlRG9tYWluKCkge1xuICAgICAgdmFyIGlzU291cmNlRG9tYWluO1xuICAgIC8qXG4gICAgICogQklUIGNoYW5nZXM6IGNvbW1lbnQgb3V0IHRoZSBvcmlnaW5hbCBtYXNvbiBjb2RlLiBXZSB1c2UgcmVnZXhwIHRvIG1hdGNoIGFsbCBhbWF6b24gZG9tYWlucyBpbnN0ZWFkIG9mIGN1cnJlbnQgZG9tYWluLlxuICAgICAqL1xuICAgICAgICAvL2lzU291cmNlRG9tYWluID0gZG9jdW1lbnQuZG9tYWluLm1hdGNoKC9eKD86d3d3XFwuKT88JSAkYmttRG9tYWluICU+LykgfHwgZG9jdW1lbnQuZG9tYWluLm1hdGNoKC88JSAkUmVxdWVzdC0+Z2V0U2VydmVyTmFtZSAlPi8pO1xuXG4gICAgICAgIGlzU291cmNlRG9tYWluID0gZG9jdW1lbnQuZG9tYWluLm1hdGNoKC9eKD86d3d3XFwuKT9hbWF6b24uKGNvbXxlc3xmcnxjby51a3xjbnxjby5qcHxjYXxpdHxkZXxpbikvKTtcbiAgICAgICAgcmV0dXJuIGlzU291cmNlRG9tYWluO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBpc0JLTUxvY2FsRG9tYWluKCkge1xuICAgICAgICAvLyBCSVQgY2hhbmdlczogdGhpcyBvbmUgbWF0Y2hlcyBzbWlsZS5hbWF6b24uY29tLCBidXQgaXNCS01Tb3VyY2VEb21haW4gZG9lc24ndC5cbiAgICAgICAgLy9pc0xvY2FsRG9tYWluID0gZG9jdW1lbnQuZG9tYWluLm1hdGNoKC9eKD86d3d3XFwufC4qXFwuKT88JSAkYmttRG9tYWluICU+LykgfHwgZG9jdW1lbnQuZG9tYWluLm1hdGNoKC88JSAkUmVxdWVzdC0+Z2V0U2VydmVyTmFtZSAlPi8pO1xuICAgICAgICByZXR1cm4gZG9jdW1lbnQuZG9tYWluLm1hdGNoKC9eKD86d3d3XFwufC4qXFwuKT9hbWF6b24uKGNvbXxlc3xmcnxjby51a3xjbnxjby5qcHxjYXxpdHxkZXxpbikvKTtcbiAgICAgIH07XG5cbiAgICBmdW5jdGlvbiBpc0luZGlhbkFtYXpvbkRvbWFpbigpIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LmRvbWFpbi5tYXRjaCgvXig/Ond3d1xcLnwuKlxcLik/YW1hem9uLmluLyk7XG4gICAgfVxuXG4gICAgdmFyIFBhZ2VTY3JhcGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLml0ZW1EYXRhID0ge307XG5cbiAgICAgIHRoaXMuaXRlbURhdGEgPSB0aGlzLmdldFZlbmRvckl0ZW1EYXRhKCk7XG4gICAgICBpZighdGhpcy5pdGVtRGF0YSkge1xuICAgICAgICB0aGlzLml0ZW1EYXRhID0gdGhpcy5nZXRHZW5lcmljSXRlbURhdGEoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgUGFnZVNjcmFwZXIucHJvdG90eXBlLmdldFZlbmRvckl0ZW1EYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGRhdGEgPSBudWxsO1xuICAgICAgICAgIHZhciBpc0FtYXpvbiA9IGlzQktNU291cmNlRG9tYWluKCk7XG4gICAgICAgICAgaWYgKGlzQW1hem9uICYmICFpc1ZlbmRvcigpKSB7XG4gICAgICAgICAgICBkYXRhID0gdGhpcy5wYXJzZUFtYXpvblZlbmRvckRhdGEoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJrUGFnZVZlcnNpb24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnQVVXTEJrUGFnZVZlcnNpb24nKTtcbiAgICAgICAgICAgIGlmICh0aGlzLml0ZW1EYXRhICYmIHRoaXMuYmtQYWdlVmVyc2lvbiAmJiB0aGlzLml0ZW1EYXRhLnZlcnNpb24gPT0gcGFyc2VJbnQodGhpcy5ia1BhZ2VWZXJzaW9uLmlubmVySFRNTCkpIHtcbiAgICAgICAgICAgICAgZGF0YSA9IHRoaXMuaXRlbURhdGE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZGF0YSkge1xuICAgICAgICAgICAgICBkYXRhID0gdGhpcy5wYXJzZUdlbmVyaWNWZW5kb3JEYXRhKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZGF0YSkge1xuICAgICAgICAgICAgICBkYXRhID0gdGhpcy5wYXJzZUdvb2dsZUNoZWNrb3V0VmVuZG9yRGF0YSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWRhdGEgJiYgaXNBbWF6b24gJiYgaXNWZW5kb3IoKSkge1xuICAgICAgICAgICAgICBkYXRhID0gdGhpcy5wYXJzZUFtYXpvblZlbmRvckRhdGEoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9O1xuXG4gICAgUGFnZVNjcmFwZXIucHJvdG90eXBlLmdldEdlbmVyaWNJdGVtRGF0YSA9IGZ1bmN0aW9uKCl7XG4gICAgICB2YXIgaXRlbURhdGE6YW55ID0ge1widW52ZXJpZmllZFwiIDogdHJ1ZX07IC8vIEJJVCBjaGFuZ2VzOiBhZGQgdHlwZSBkZWNsYXJhdGlvbiBzaW5jZSB3ZSBuZWVkIHRvIGluY2x1ZGVkIGluIFRTIGFuZCBjb21waWxlIGl0XG4gICAgICBpdGVtRGF0YS50aXRsZSA9IHRoaXMuZ2V0VGl0bGUoKTtcbiAgICAgIGl0ZW1EYXRhLnByaWNlID0gdGhpcy5nZXRQcmljZSgpO1xuICAgICAgaXRlbURhdGEuaW1hZ2VBcnJheSA9IHRoaXMuZ2V0R2VuZXJpY0ltYWdlRGF0YSgpO1xuICAgICAgcmV0dXJuIGl0ZW1EYXRhO1xuICAgIH07XG5cbiAgICBQYWdlU2NyYXBlci5wcm90b3R5cGUuZ2V0UHJpY2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgICB2YXIgbm9kZXMgPSBbXTtcbiAgICAgICAgdmFyIG5vblplcm9SZSA9IC9bMS05XS87XG4gICAgICAgIHZhciBwcmljZUZvcm1hdFJlID0gLygoPzpSP1xcJHxVU0R8XFx1MjBCOXxcXHUyMEE4fFxcJiM4MzYwXFw7fFxcJiM4Mzc3XFw7fFJzfFJzXFwufFJzXFwuXFwmbmJzcFxcO3xcXCZwb3VuZFxcO3xcXCZcXCMxNjNcXDt8XFwmXFwjeGEzXFw7fFxcdTAwQTN8XFwmeWVuXFw7fFxcdUZGRTV8XFwmXFwjMTY1XFw7fFxcJlxcI3hhNVxcO3xcXHUwMEE1fGV1cnxcXCZcXCM4MzY0XFw7fFxcJlxcI3gyMGFjXFw7KVxccypcXGRbMC05XFwsXFwuXSopL2dpO1xuICAgICAgICB2YXIgaW5kaWFuQ3VycmVuY3lDbGFzc1JlID0gL1xcYihjdXJyZW5jeUlOUnxyc3xydXBlZUN1cnJlbmN5KVxcYi87XG4gICAgICAgIHZhciBpbmRpYW5DdXJyZW50Rm9udEZhbWlseVJlID0gL3J1cGVlL2k7XG4gICAgICAgIHZhciBpbmRpYW5SdXBlZVN5bWJvbCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoODM3Nyk7IC8vIHRoZSBJbmRpYW4gUnVwZWUgc3ltYm9sIOKCuTtcbiAgICAgICAgdmFyIHRleHROb2RlUmUgPSAvdGV4dG5vZGUvaTtcbiAgICAgICAgdmFyIGVtUmUgPSAvZW0vO1xuICAgICAgICB2YXIgcHJpY2VSYW5nZVJlID0gL14oXFxzfHRvfFxcZHxcXC58XFwkfFxcLXwsKSskLztcbiAgICAgICAgdmFyIHByaWNlQm9udXNSZSA9IC9jbHVifHRvdGFsfHByaWNlfHNhbGV8bm93fGJyaWdodHJlZC9pO1xuICAgICAgICB2YXIgb3V0T2ZTdG9ja1JlID0gL3NvbGRvdXR8Y3VycmVudGx5dW5hdmFpbGFibGV8b3V0b2ZzdG9jay9pO1xuICAgICAgICB2YXIgdGFnUmUgPSAvXihoMXxoMnxoM3xifHN0cm9uZ3xzYWxlKSQvaTtcbiAgICAgICAgdmFyIGFuY2hvclRhZ1JlID0gL15hJC9pO1xuXG4gICAgICAgIHZhciBwZW5SZSA9IC9vcmlnaW5hbHxoZWFkZXJ8aXRlbXN8dW5kZXJ8Y2FydHxtb3JlfG5hdnx1cHNlbGwvaTtcblxuICAgICAgICB2YXIgbGFzdCA9IFwiXCI7XG4gICAgICAgIHZhciBsYXN0Tm9kZTtcbiAgICAgICAgdmFyIG91dE9mU3RvY2tJbmRleCA9IC0xO1xuICAgICAgICB2YXIgZm91bmRQb3NpdGl2ZVByaWNlQmVmb3JlT09TTXNnID0gMDtcblxuICAgICAgICB2YXIgcGVyZm9ybU91dE9mU3RvY2tDaGVjayA9IGZ1bmN0aW9uKGRvbWFpblN0cikge1xuICAgICAgICAgICB2YXIgYmxhY2tsaXN0ID0gbmV3IEFycmF5KFwidG95c3J1cy5jb21cIiwgXCJiYWJpZXNydXMuY29tXCIsIFwid2FsbWFydC5jb21cIik7XG5cbiAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBibGFja2xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICB2YXIgcmVnZXggPSBuZXcgUmVnRXhwKFwiXig/Ond3d1xcLik/XCIgKyBibGFja2xpc3RbaV0sIFwiaVwiKTtcbiAgICAgICAgICAgICBpZiAocmVnZXgudGVzdChkb21haW5TdHIpKSB7XG4gICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgfVxuICAgICAgICAgICB9XG5cbiAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGdldFBhcmVudHMgPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgICAgICB2YXIgcGFyZW50cyA9IFtdO1xuICAgICAgICAgICAgdmFyIHRyYXZlcnNlID0gbm9kZTtcbiAgICAgICAgICAgIHdoaWxlKHRyYXZlcnNlLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgIHBhcmVudHMucHVzaCh0cmF2ZXJzZS5wYXJlbnROb2RlKTtcbiAgICAgICAgICAgIHRyYXZlcnNlID0gdHJhdmVyc2UucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwYXJlbnRzO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBmaW5kTXV0dWFsUGFyZW50ID0gZnVuY3Rpb24oZmlyc3Qsc2Vjb25kKSB7XG5cbiAgICAgICAgICAgIHZhciBmaXJzdFBhcmVudHMgPSBnZXRQYXJlbnRzKGZpcnN0KTtcbiAgICAgICAgICAgIHZhciBzZWNvbmRQYXJlbnRzID0gZ2V0UGFyZW50cyhzZWNvbmQpO1xuXG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgZmlyc3RQYXJlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBmb3IodmFyIGogPSAwOyBqIDwgc2Vjb25kUGFyZW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGlmKGZpcnN0UGFyZW50c1tpXSA9PT0gc2Vjb25kUGFyZW50c1tqXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlyc3RQYXJlbnRzW2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgZ2V0U3R5bGVGdW5jID0gZnVuY3Rpb24obm9kZSwgcHNldWRvRWxlU2VsZWN0b3IgPSBudWxsKSB7XG4gICAgICAgICAgICBpZihkb2N1bWVudC5kZWZhdWx0VmlldyAmJiBkb2N1bWVudC5kZWZhdWx0Vmlldy5nZXRDb21wdXRlZFN0eWxlKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbXB1dGVkU3R5bGUgPSBkb2N1bWVudC5kZWZhdWx0Vmlldy5nZXRDb21wdXRlZFN0eWxlKG5vZGUsIHBzZXVkb0VsZVNlbGVjdG9yKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocHJvcGVydHlOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUocHJvcGVydHlOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHByb3BlcnR5TmFtZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXBwZXIgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcImZvbnQtc2l6ZVwiIDogXCJmb250U2l6ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJmb250LXdlaWdodFwiIDogXCJmb250V2VpZ2h0XCIsXG4gICAgICAgICAgICAgICAgXCJ0ZXh0LWRlY29yYXRpb25cIiA6IFwidGV4dERlY29yYXRpb25cIlxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub2RlLmN1cnJlbnRTdHlsZVsgbWFwcGVyW3Byb3BlcnR5TmFtZV0gPyBtYXBwZXJbcHJvcGVydHlOYW1lXSA6IHByb3BlcnR5TmFtZSBdO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVjayBpZiBwc2V1ZG8gZWxlbWVudHMgbWF0Y2ggSW5kaWEgUnVwZWUncyBmb250IGZhbWlseS5cbiAgICAgICAgICovXG4gICAgICAgIHZhciBtYXRjaEluZGlhblJ1cGVlID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgXCJjdXJyZW5jeUlOUlwiIGNsYXNzIChJTiBtYXJrZXRwbGFjZSB1c2VzIGEgc3R5bGVkIGltYWdlIGluc3RlYWQgb2YgdGhlIHVuaWNvZGUgc3ltYm9sKSBpcyBhcHBsaWVkLlxuICAgICAgICAgICAgaWYgKGlzSW5kaWFuQW1hem9uRG9tYWluKCkgJiYgbm9kZS5wYXJlbnROb2RlICYmXG4gICAgICAgICAgICAgICAgaW5kaWFuQ3VycmVuY3lDbGFzc1JlLnRlc3Qobm9kZS5wYXJlbnROb2RlLmNoaWxkTm9kZXNbMF0uY2xhc3NOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAobm9kZS5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgLy8gamFib25nIHBsYWNlcyBhIDo6YmVmb3JlIGVsZW1lbnQgYW5kIHNldCBpdHMgZm9udC1mYW1pbHkgdG8gXCJydXBlZVwiIGJlZm9yZSB0aGUgYWN0dWFsIHByaWNlLlxuICAgICAgICAgICAgICAgIHZhciBnZXRTdHlsZSA9IGdldFN0eWxlRnVuYyhub2RlLnBhcmVudE5vZGUsIFwiOmJlZm9yZVwiKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kaWFuQ3VycmVudEZvbnRGYW1pbHlSZS50ZXN0KGdldFN0eWxlKFwiZm9udC1mYW1pbHlcIikpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBuYWFwdG9sIHBsYWNlcyBhIHNwYW4gd2l0aCBjbGFzcyBuYW1lIFwicnNcIiBhdCB0aGUgc2FtZSBsZXZlbCBvZiB0aGUgcHJpY2UgbnVtYmVyXG4gICAgICAgICAgICAgICAgaWYgKG5vZGUucGFyZW50Tm9kZS5maXJzdEVsZW1lbnRDaGlsZCAmJlxuICAgICAgICAgICAgICAgICAgICBpbmRpYW5DdXJyZW5jeUNsYXNzUmUudGVzdChub2RlLnBhcmVudE5vZGUuZmlyc3RFbGVtZW50Q2hpbGQuY2xhc3NOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobm9kZS5wYXJlbnROb2RlICYmIG5vZGUucGFyZW50Tm9kZS5wYXJlbnROb2RlICYmIG5vZGUucGFyZW50Tm9kZS5wYXJlbnROb2RlLmZpcnN0RWxlbWVudENoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGluZmliZWFtIHBsYWNlcyBhbiBlbGVtZW50IGF0IHRoZSBzYW1lIGxldmVsIG9mIHRoZSBwcmljZSBzcGFuIGFuZCBzZXQgaXRzIGZvbnQtZmFtaWx5IHRvIFwicnVwZWVcIlxuICAgICAgICAgICAgICAgICAgICBnZXRTdHlsZSA9IGdldFN0eWxlRnVuYyhub2RlLnBhcmVudE5vZGUucGFyZW50Tm9kZS5maXJzdEVsZW1lbnRDaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRpYW5DdXJyZW50Rm9udEZhbWlseVJlLnRlc3QoZ2V0U3R5bGUoXCJmb250LWZhbWlseVwiKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8ganVuZ2xlZSBwbGFjZXMgYSBzcGFuIHdpdGggY2xhc3MgbmFtZSBcInJ1cGVlQ3VycmVuY3lcIiBhdCB0aGUgc2FtZSBsZXZlbCBvZiB0aGUgcHJpY2Ugc3BhblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kaWFuQ3VycmVuY3lDbGFzc1JlLnRlc3Qobm9kZS5wYXJlbnROb2RlLnBhcmVudE5vZGUuZmlyc3RFbGVtZW50Q2hpbGQuY2xhc3NOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGdldFdhbGtlciA9IGZ1bmN0aW9uKCkgOiBhbnkgeyAvLyBCSVQgY2hhbmdlczogYWRkIHR5cGUgZGVjbGFyYXRpb24gc2luY2Ugd2UgbmVlZCB0byBpbmNsdWRlZCBpbiBUUyBhbmQgY29tcGlsZSBpdFxuICAgICAgICAgICAgaWYoZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcikge1xuICAgICAgICAgICAgICAgIC8vIEluIElFLCBUcmVlV2Fsa2VyIG9ubHkgYWNjZXB0cyBhIGZ1bmN0aW9uIGFzIHRoZSBmaWx0ZXIgcGFyYW1ldGVyLCBmaWx0ZXIgY2FuIG5vdCBiZSBvYmplY3RcbiAgICAgICAgICAgICAgICAvLyB7QGxpbmsgaHR0cHM6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9mZjk3NDgyMCh2PXZzLjg1KS5hc3B4fVxuICAgICAgICAgICAgICAgIC8vIEJ1dCBhbGwgb3RoZXIgYnJvd3NlcnMgYWNjZXB0IGEgZnVuY3Rpb24gYXMgdGhlIGZpbHRlciBwYXJhbWV0ZXIgOlxuICAgICAgICAgICAgICAgIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNTk4MjY0OC9yZWNvbW1lbmRhdGlvbnMtZm9yLXdvcmtpbmctYXJvdW5kLWllOS10cmVld2Fsa2VyLWZpbHRlci1idWdcbiAgICAgICAgICAgICAgICAvLyBTbyB0aGUgYmVsb3cgc29sdXRpb24gc2hvdWxkIHdvcmsgYWNyb3NzIGFsbCB0aGUgYnJvd3NlcnNcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpbHRlciA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBOb2RlRmlsdGVyLkZJTFRFUl9BQ0NFUFQ7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIC8vIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIGFjY2VwdE5vZGUgOiBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgcmV0dXJuIE5vZGVGaWx0ZXIuRklMVEVSX0FDQ0VQVDtcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICBGSUxURVJfQUNDRVBUICAgICAgICAgICAgICAgIDogMSxcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIEZJTFRFUl9SRUpFQ1QgICAgICAgICAgICAgICAgOiAyLFxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgRklMVEVSX1NLSVAgICAgICAgICAgICAgICAgICA6IDMsXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICBTSE9XX0VMRU1FTlQgICAgICAgICAgICAgICAgIDogMSxcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIFNIT1dfQVRUUklCVVRFICAgICAgICAgICAgICAgOiAyLFxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgU0hPV19URVhUICAgICAgICAgICAgICAgICAgICA6IDQsXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICBTSE9XX0NEQVRBX1NFQ1RJT04gICAgICAgICAgIDogOCxcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIFNIT1dfRU5USVRZX1JFRkVSRU5DRSAgICAgICAgOiAxNixcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIFNIT1dfRU5USVRZICAgICAgICAgICAgICAgICAgOiAzMixcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIFNIT1dfUFJPQ0VTU0lOR19JTlNUUlVDVElPTiAgOiA2NCxcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIFNIT1dfQ09NTUVOVCAgICAgICAgICAgICAgICAgOiAxMjgsXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICBTSE9XX0RPQ1VNRU5UICAgICAgICAgICAgICAgIDogMjU2LFxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgU0hPV19ET0NVTUVOVF9UWVBFICAgICAgICAgICA6IDUxMixcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgIFNIT1dfRE9DVU1FTlRfRlJBR01FTlQgICAgICAgOiAxMDI0LFxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgU0hPV19OT1RBVElPTiAgICAgICAgICAgICAgICA6IDIwNDgsXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICBTSE9XX0FMTCAgICAgICAgICAgICAgICAgICAgIDogNDI5NDk2NzI5NVxuICAgICAgICAgICAgICAgICAgICAvLyB9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcihkb2N1bWVudC5ib2R5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE5vZGVGaWx0ZXIuU0hPV19URVhULFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxhbnk+ZmlsdGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG5cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBxIDogW10sXG4gICAgICAgICAgICAgICAgaW50aWFsaXplZCA6IDAsXG4gICAgICAgICAgICAgICAgY3VycmVudE5vZGUgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgbmV4dE5vZGUgOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYoIXRoaXMuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucS5wdXNoKGRvY3VtZW50LmJvZHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB3aGlsZSh0aGlzLnEubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgd29ya2luZyA9IHRoaXMucS5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHdvcmtpbmcubm9kZVR5cGUgPT0gMykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB3b3JraW5nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmKHdvcmtpbmcuY2hpbGROb2Rlcykge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZih3b3JraW5nLnN0eWxlICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHdvcmtpbmcuc3R5bGUudmlzaWJpbGl0eSA9PSBcImhpZGRlblwiIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdvcmtpbmcuc3R5bGUuZGlzcGxheSA9PSBcIm5vbmVcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkcmVuID0gbmV3IEFycmF5KHdvcmtpbmcuY2hpbGROb2Rlcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCB3b3JraW5nLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW5baV0gPSB3b3JraW5nLmNoaWxkTm9kZXNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuLnJldmVyc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnEgPSB0aGlzLnEuY29uY2F0KGNoaWxkcmVuKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgZ2V0Rm9udFNpemVQeCA9IGZ1bmN0aW9uKHN0eWxlRnVuYykge1xuXG4gICAgICAgICAgICB2YXIgZm9udFNpemUgPSBzdHlsZUZ1bmMoXCJmb250LXNpemVcIikgfHwgXCJcIjtcbiAgICAgICAgICAgIHZhciBzaXplRmFjdG9yID0gZW1SZS50ZXN0KGZvbnRTaXplKSA/IDE2IDogMTtcblxuICAgICAgICAgICAgZm9udFNpemUgPSBmb250U2l6ZS5yZXBsYWNlKC9weHxlbXxwdC8sXCJcIik7XG4gICAgICAgICAgICBmb250U2l6ZSAtPSAwO1xuXG4gICAgICAgICAgICBpZighaXNOYU4oZm9udFNpemUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvbnRTaXplICogc2l6ZUZhY3RvcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGdldE9mZnNldCA9IGZ1bmN0aW9uKG5vZGUpIHtcblxuICAgICAgICB2YXIgb2Zmc2V0ID0gbm9kZS5vZmZzZXRUb3A7XG5cbiAgICAgICAgd2hpbGUobm9kZS5vZmZzZXRQYXJlbnQpIHtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLm9mZnNldFBhcmVudDtcbiAgICAgICAgICAgIG9mZnNldCArPSBub2RlLm9mZnNldFRvcDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGdldFNjb3JlID0gZnVuY3Rpb24obm9kZSwgaW5kZXgpIHtcblxuICAgICAgICAgICAgdmFyIGRvbU5vZGUgPSBub2RlLm5vZGU7XG4gICAgICAgICAgICB2YXIgc3R5bGVkTm9kZSA9IGRvbU5vZGUubm9kZVR5cGUgPT0gMyA/IGRvbU5vZGUucGFyZW50Tm9kZSA6IGRvbU5vZGU7XG5cbiAgICAgICAgICAgIHZhciBwcmljZSA9IG5vZGUucHJpY2U7XG4gICAgICAgICAgICB2YXIgY29udGVudCA9IFwiXCI7XG5cbiAgICAgICAgICAgIGlmKGRvbU5vZGUubm9kZVR5cGUgPT0gMykge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBkb21Ob2RlLmRhdGE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnRlbnQgPSBkb21Ob2RlLmlubmVyVGV4dCB8fCBkb21Ob2RlLnRleHRDb250ZW50O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc2NvcmUgPSAwO1xuICAgICAgICAgICAgdmFyIGdldFN0eWxlID0gZ2V0U3R5bGVGdW5jKHN0eWxlZE5vZGUpO1xuXG4gICAgICAgIHZhciBmb250V2VpZ2h0ID0gZ2V0U3R5bGUoXCJmb250LXdlaWdodFwiKTtcblxuICAgICAgICAgICAgaWYoZ2V0U3R5bGUoXCJmb250LXdlaWdodFwiKSA9PSBcImJvbGRcIikge1xuICAgICAgICAgICAgICAgIHNjb3JlICs9IDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgaWYoIXN0eWxlZE5vZGUub2Zmc2V0V2lkdGggJiYgIXN0eWxlZE5vZGUub2Zmc2V0SGVpZ2h0IHx8XG4gICAgICAgICAgICAgICBnZXRTdHlsZShcInZpc2liaWxpdHlcIikgPT0gXCJoaWRkZW5cIiB8fFxuICAgICAgICAgICAgICAgZ2V0U3R5bGUoXCJkaXNwbGF5XCIpID09IFwibm9uZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcmUgLT0gMTAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcGFyZW50c0NoaWxkcmVuQ29udGVudCA9IChkb21Ob2RlLnBhcmVudE5vZGUuaW5uZXJUZXh0IHx8IGRvbU5vZGUucGFyZW50Tm9kZS50ZXh0Q29udGVudCkucmVwbGFjZSgvXFxzL2csXCJcIik7XG4gICAgICAgIHZhciBzdHJpcHBlZENvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL1xccysvZyxcIlwiKTtcblxuXG5cbiAgICAgICAgICAgICAgICBpZighbm9uWmVyb1JlLnRlc3QocHJpY2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3JlIC09IDEwMDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN0cmlwcGVkQ29udGVudE5vUHJpY2UgPSBzdHJpcHBlZENvbnRlbnQucmVwbGFjZSgvcHJpY2V8b3VyL2lnLFwiXCIpO1xuICAgICAgICAgICAgaWYoc3RyaXBwZWRDb250ZW50Tm9QcmljZS5sZW5ndGggPCBwcmljZS5sZW5ndGggKiAyICsgNCkge1xuICAgICAgICAgICAgc2NvcmUgKz0gMTA7XG4gICAgICAgIH1cblxuICAgICAgICBpZihwcmljZVJhbmdlUmUudGVzdChzdHJpcHBlZENvbnRlbnQpKSB7XG4gICAgICAgICAgICBzY29yZSArPSAyO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYocHJpY2UuaW5kZXhPZihcIi5cIikgIT0gLTEpIHtcbiAgICAgICAgICAgIHNjb3JlICs9IDI7XG4gICAgICAgIH1cblxuICAgICAgICBzY29yZSAtPSBNYXRoLmFicyhnZXRPZmZzZXQoc3R5bGVkTm9kZSkgLyA1MDApO1xuXG4gICAgICAgICAgICBzY29yZSArPSBnZXRGb250U2l6ZVB4KGdldFN0eWxlKTtcblxuICAgICAgICAgICAgaWYgKHBlblJlLnRlc3QoY29udGVudCkpIHsgc2NvcmUtPTQ7IH1cbiAgICAgICAgICAgIGlmIChwcmljZUJvbnVzUmUudGVzdChjb250ZW50KSkgeyBzY29yZSsrOyB9XG4gICAgICAgICAgICBkb21Ob2RlID0gc3R5bGVkTm9kZTtcblxuICAgICAgICAgICAgdmFyIHBhcmVudHNXYWxrZWQgPSAwO1xuXG4gICAgICAgICAgICB3aGlsZSAoZG9tTm9kZSAhPT0gbnVsbCAmJlxuICAgICAgICAgICAgICAgZG9tTm9kZSAhPSBkb2N1bWVudC5ib2R5ICYmXG4gICAgICAgICAgICAgICAgICAgcGFyZW50c1dhbGtlZCsrIDwgNCApIHtcblxuXG4gICAgICAgICAgICBpZihwYXJlbnRzV2Fsa2VkICE9PSAwKSB7XG4gICAgICAgICAgICBnZXRTdHlsZSA9IGdldFN0eWxlRnVuYyhkb21Ob2RlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmKGdldFN0eWxlKFwidGV4dC1kZWNvcmF0aW9uXCIpID09IFwibGluZS10aHJvdWdoXCIpIHtcbiAgICAgICAgICAgICBzY29yZSAtPTEwMDtcbiAgICAgICAgICAgICAgICB9XG5cblxuXG4gICAgICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGRvbU5vZGUuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmKGRvbU5vZGUuY2hpbGROb2Rlc1tpXS5ub2RlVHlwZSA9PSAzKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0bm9kZSA9IGRvbU5vZGUuY2hpbGROb2Rlc1tpXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYodG5vZGUuZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHByaWNlQm9udXNSZS50ZXN0KHRub2RlLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3JlICs9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYocGVuUmUudGVzdCh0bm9kZS5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29yZSAtPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoYW5jaG9yVGFnUmUudGVzdChkb21Ob2RlLnRhZ05hbWUpKSB7XG4gICAgICAgICAgICBzY29yZSAtPTUgO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwcmljZUJvbnVzUmUudGVzdChkb21Ob2RlLmdldEF0dHJpYnV0ZSgnY2xhc3MnKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb21Ob2RlLmdldEF0dHJpYnV0ZSgnY2xhc3NOYW1lJykpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3JlKz0xO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwcmljZUJvbnVzUmUudGVzdChkb21Ob2RlLmlkKSkge1xuICAgICAgICAgICAgICAgICAgICBzY29yZSs9MTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGFnUmUudGVzdChkb21Ob2RlLnRhZ05hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3JlICs9IDE7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHBlblJlLnRlc3QoZG9tTm9kZS50YWdOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICBzY29yZSAtPSAxO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwZW5SZS50ZXN0KGRvbU5vZGUuaWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3JlIC09IDI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHBlblJlLnRlc3QoZG9tTm9kZS5nZXRBdHRyaWJ1dGUoJ2NsYXNzJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb21Ob2RlLmdldEF0dHJpYnV0ZSgnY2xhc3NOYW1lJykpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3JlIC09IDI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZG9tTm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZTtcblxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIHNjb3JlIC09IGNvbnRlbnQubGVuZ3RoIC8gMTAwO1xuXG4gICAgICAgICAgICBzY29yZSAtPSBpbmRleCAvIDU7XG5cbiAgICAgICAgICAgIHJldHVybiBzY29yZTtcblxuICAgICAgICB9O1xuXG4gICAgICAgIHZhciB3YWxrZXIgPSBnZXRXYWxrZXIoKTtcblxuXG4gICAgICAgIHdoaWxlKHdhbGtlci5uZXh0Tm9kZSgpICYmIG5vZGVzLmxlbmd0aCA8IDEwMCkge1xuXG4gICAgICAgICAgICBpZiggbm9kZXMubGVuZ3RoICUgMTAwID09PSAwICkge1xuICAgICAgICAgICAgICAgIGlmKCBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHN0YXJ0VGltZSA+IDEyMDAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBub2RlID0gd2Fsa2VyLmN1cnJlbnROb2RlO1xuXG4gICAgICAgICAgICB2YXIgdGV4dCA9IG5vZGUuZGF0YS5yZXBsYWNlKC9cXHMvZyxcIlwiKTtcbiAgICAgICAgICAgIHByaWNlRm9ybWF0UmUubGFzdEluZGV4ID0gMDtcbiAgICAgICAgICAgIHZhciBwcmljZU1hdGNoID0gdGV4dC5tYXRjaChwcmljZUZvcm1hdFJlKTtcblxuICAgICAgICAgICAgLy9JZiBPdXRvZlN0b2NrSW5kZXggaGFzIG5vdCBiZWVuIHNldCBhbmQgd2UgZm91bmQgYSBPT1Mgc3RyaW5nIHRoZW5cbiAgICAgICAgICAgIC8vIHdlIHNldCB0aGUgaW5kZXggdG8gbnVtYmVyIG9mIHByaWNlIG1hdGNoZXMgZm91bmQgYmVmb3JlIHRoaXMgbWF0Y2hcbiAgICAgICAgICAgIGlmKChvdXRPZlN0b2NrSW5kZXggPCAwKSAmJiBvdXRPZlN0b2NrUmUudGVzdCh0ZXh0KSAmJiBwZXJmb3JtT3V0T2ZTdG9ja0NoZWNrKGRvY3VtZW50LmRvbWFpbikpIHtcbiAgICAgICAgICAgICAgICAgb3V0T2ZTdG9ja0luZGV4ID0gbm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYocHJpY2VNYXRjaCkge1xuXG4gICAgICAgICAgICAgICBpZiAocHJpY2VNYXRjaFswXS5tYXRjaCgvXFwuJC9nKSAmJiB3YWxrZXIubmV4dE5vZGUoKSkge1xuICAgICAgICAgICAgICAgICB2YXIgbmV4dE5vZGUgPSB3YWxrZXIuY3VycmVudE5vZGU7XG4gICAgICAgICAgICAgICAgIGlmIChuZXh0Tm9kZSAmJiBuZXh0Tm9kZS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgdmFyIG5leHRQcmljZSA9IG5leHROb2RlLmRhdGEucmVwbGFjZSgvXFxzL2csXCJcIik7XG4gICAgICAgICAgICAgICAgICAgaWYgKG5leHRQcmljZSAmJiBpc05hTihuZXh0UHJpY2UpKSB7XG4gICAgICAgICAgICAgICAgICAgICBuZXh0UHJpY2UgPSBcIjAwXCI7XG4gICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgIHByaWNlTWF0Y2hbMF0gKz0gbmV4dFByaWNlO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9IGVsc2UgaWYgKHByaWNlTWF0Y2hbMF0ubWF0Y2goL1xcLCQvZykpIHtcbiAgICAgICAgICAgICAgICAgcHJpY2VNYXRjaFswXSA9IHByaWNlTWF0Y2hbMF0uc3Vic3RyaW5nKDAsIHByaWNlTWF0Y2hbMF0ubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgIG5vZGVzLnB1c2goXG4gICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJub2RlXCIgOiBub2RlLFxuICAgICAgICAgICAgICAgICAgICBcInByaWNlXCIgOiBwcmljZU1hdGNoWzBdXG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICB0ZXh0ID0gXCJcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGV4dCAhPT0gXCJcIiAmJiBtYXRjaEluZGlhblJ1cGVlKG5vZGUpKSB7XG4gICAgICAgICAgICAgICAvLyB0aGlzIGlzIGEgSW5kaWFuIFJ1cGVlIHByaWNlIGxhYmVsLiBXZSBhZGQgdGhlIFJ1cGVlIHN5bWJvbCB0byB0aGUgcHJpY2VcbiAgICAgICAgICAgICAgIG5vZGVzLnB1c2goe1wibm9kZVwiOiBub2RlLCBcInByaWNlXCI6IGluZGlhblJ1cGVlU3ltYm9sICsgdGV4dH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmKCBsYXN0ICE9PSBcIlwiICYmIHRleHQgIT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgIHByaWNlTWF0Y2ggPSAobGFzdCArIHRleHQpLm1hdGNoKHByaWNlRm9ybWF0UmUpO1xuICAgICAgICAgICAgICAgaWYocHJpY2VNYXRjaCkge1xuICAgICAgICAgICAgICAgICB2YXIgbXV0dWFsID0gZmluZE11dHVhbFBhcmVudChsYXN0Tm9kZSxub2RlKTtcbiAgICAgICAgICAgICAgICAgbm9kZXMucHVzaCh7XCJub2RlXCIgOiBtdXR1YWwsIFwicHJpY2VcIiA6IHByaWNlTWF0Y2hbMF19KTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFzdE5vZGUgPSBub2RlO1xuICAgICAgICAgICAgbGFzdCA9IHRleHQ7XG4gICAgICAgIH1cblxuXG4gICAgICAgIHZhciBtYXggPSB1bmRlZmluZWQ7XG4gICAgICAgIHZhciBtYXhOb2RlID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHNjb3JlID0gZ2V0U2NvcmUobm9kZXNbaV0sIGkpO1xuICAgICAgICAgICAgLy9UcnlpbmcgdG8gc2VlIGlmIHdlIGZvdW5kIGEgcG9zaXRpdmUgcHJpY2UgYmVmb3JlIHdlIGZvdW5kIGEgT09TIG1hdGNoXG4gICAgICAgICAgICBpZigoaSA8IG91dE9mU3RvY2tJbmRleCkgJiYgKHNjb3JlID4gMCkpIHtcbiAgICAgICAgICAgICAgIGZvdW5kUG9zaXRpdmVQcmljZUJlZm9yZU9PU01zZyA9IDE7XG4gICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYobWF4ID09PSB1bmRlZmluZWQgfHwgc2NvcmUgPiBtYXgpIHtcbiAgICAgICAgICAgICBtYXggPSBzY29yZTtcbiAgICAgICAgICAgICBtYXhOb2RlID0gbm9kZXNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZihtYXhOb2RlICYmICgob3V0T2ZTdG9ja0luZGV4IDwgMCkgfHwgZm91bmRQb3NpdGl2ZVByaWNlQmVmb3JlT09TTXNnKSkge1xuICAgICAgICAgcmV0dXJuIG1heE5vZGUucHJpY2U7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKFJlZ0V4cChcIl5odHRwcz86Ly93d3cuZ29vZ2xlLmNvbS9zaG9wcGluZy9cIikudGVzdCgvKndpbmRvdy5sb2NhdGlvbi50b1N0cmluZygpKi9kb2N1bWVudC5VUkwpKSB7XG4gICAgICB2YXIgZGVtb3RlU3JjID0gbmV3IFJlZ0V4cChcIm1hcHMuZ29vZ2xlYXBpcy5jb218Z29vZ2xlYXBpc1xcLmNvbS8uKj1hcGlcXHxzbWFydG1hcHNcIik7XG4gICAgICB2YXIgcHJvbW90ZUlkID0gbmV3IFJlZ0V4cChcIl5wcC1hbHRpbWctaW5pdC1tYWluJFwiKTtcbiAgICAgIFBhZ2VTY3JhcGVyLnByb3RvdHlwZS5zb3J0SW1hZ2UgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiAoTnVtYmVyKHByb21vdGVJZC50ZXN0KGIuaWQpKSAtIE51bWJlcihwcm9tb3RlSWQudGVzdChhLmlkKSkpIHx8IChOdW1iZXIoZGVtb3RlU3JjLnRlc3QoYS5zcmMpKSAtIE51bWJlcihkZW1vdGVTcmMudGVzdChiLnNyYykpKSB8fCBOdW1iZXIoYi5oZWlnaHQqYi53aWR0aCkgLSBOdW1iZXIoYS5oZWlnaHQqYS53aWR0aCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIFBhZ2VTY3JhcGVyLnByb3RvdHlwZS5zb3J0SW1hZ2UgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgIHJldHVybiAoYi5oZWlnaHQqYi53aWR0aCkgLSAoYS5oZWlnaHQqYS53aWR0aCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgUGFnZVNjcmFwZXIucHJvdG90eXBlLmdldEdlbmVyaWNJbWFnZURhdGEgPSBmdW5jdGlvbihpbmNsdWRlU3JjKSB7XG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogVXNpbmcgJ2FueScgdG8gb3B0LW91dCBvZiBjb21waWxlLXRpbWUgY2hlY2tzLiBUaGUgSFRNTEltYWdlRWxlbWVudCBhdHRyaWJ1dGVzICdzcmNzZXQnIGFuZFxuICAgICAgICAgICAqICdjdXJyZW50U3JjJyBhcmUgbm90IHN1cHBvcnRlZCBpbiB0aGUgdmVyc2lvbiBvZiBUeXBlc2NyaXB0IHRoYXQgdGhlIGV4dGVuc2lvbiBjdXJyZW50bHkgY29tcGlsZXMgd2l0aFxuICAgICAgICAgICAqIFVwZGF0aW5nIHRoYXQgd291bGQgcmVxdWlyZSBtYWpvciBlZmZvcnQgdG8gcmVzb2x2ZSBtdWx0aXBsZSBjb25mbGljdHMuIFVzaW5nIHRoaXMgYXMgYSB0ZW1wb3JhcnkgZml4IGFzXG4gICAgICAgICAgICogdGhlIHdpc2hsaXN0IGlzIGdvaW5nIHRvIGJlIHJlZGVzaWduZWQgYW5kIHRoaXMgd2hvbGUgc2NyYXBlciB3aWxsIGJlIG1vZGlmaWVkLlxuICAgICAgICAgICAqL1xuICAgICAgICAgIHZhciBpbWdzOiBhbnkgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW1nJyk7XG4gICAgICAgICAgdmFyIGltYWdlQXJyYXkgPSBbXTtcbiAgICAgICAgICB2YXIgc3JjcyA9IHt9O1xuICAgICAgICAgIGZvciAodmFyIGk9MDtpPGltZ3MubGVuZ3RoO2krKykge1xuICAgICAgICAgICAgdmFyIGltZyA9IGltZ3NbaV07XG4gICAgICAgICAgICB2YXIgaW1hZ2VTcmM6IHN0cmluZyA9IGltZy5zcmM7XG4gICAgICAgICAgICAvLyAnY3VycmVudFNyYyByZXR1cm5zIGEgRE9NU3RyaW5nIHJlcHJlc2VudGluZyB0aGUgVVJMIHRvIHRoZSBjdXJyZW50bHkgZGlzcGxheWVkIGltYWdlLCBhbmQgdGhpcyBtYXkgY2hhbmdlXG4gICAgICAgICAgICAvLyBkeW5hbWljYWxseSBpZiAnc3Jjc2V0JyBpcyB1c2VkIGZvciByZXNwb25zaXZlIGltYWdlcy4gVGhpcyBpcyBhIGZpeCBmb3IgdGhlIGlzc3VlIHdoZXJlIHRoZSBzY3JhcGVyIGNhbm5vdFxuICAgICAgICAgICAgLy8gZGV0ZWN0IGFuIGltYWdlIGlmIGl0IGhhcyBhbiAnc3Jjc2V0JyBwcm92aWRlZCBpbnN0ZWFkIG9mICdzcmMnXG4gICAgICAgICAgICBpZiAoaW1nLnNyYy5sZW5ndGggPCA3ICYmIGltZy5zcmNzZXQubGVuZ3RoID49IDcpIHtcbiAgICAgICAgICAgICAgLy8gSUUgMTEgZG9lcyBub3Qgc3VwcG9ydCBjdXJyZW50U3JjIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBpbWcuY3VycmVudFNyYyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGltYWdlU3JjID0gaW1nLmN1cnJlbnRTcmM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbWFnZVNyYy5sZW5ndGggPiBtYXhSZXF1ZXN0TGVuZ3RoKSB7XG4gICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2YgaW1nLm5hdHVyYWxXaWR0aCAhPSAndW5kZWZpbmVkJyAmJiBpbWcubmF0dXJhbFdpZHRoID09IDAgfHwgIWltZy5jb21wbGV0ZSkge1xuICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3Jjc1tpbWFnZVNyY10pIHtcbiAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHBpeGVsQ291bnQgPSBpbWcuaGVpZ2h0ICogaW1nLndpZHRoO1xuICAgICAgICAgICAgdmFyIHNxdWFyZW5lc3MgPSAxO1xuICAgICAgICAgICAgaWYgKGltZy5pZCAmJiBpbWcuaWQgPT0gJ19fdXdsX2ltZ19jb3B5X18nKXtcbiAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGltZy5pZCAmJiBpbWcuaWQgPT0gJ3V3bF9sb2dvJyl7XG4gICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGltZy5oZWlnaHQgPiBpbWcud2lkdGggJiYgaW1nLmhlaWdodCA+IDApIHtcbiAgICAgICAgICAgICAgc3F1YXJlbmVzcyA9IGltZy53aWR0aCAvIGltZy5oZWlnaHQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGltZy53aWR0aCA+IGltZy5oZWlnaHQgJiYgaW1nLndpZHRoID4gMCkge1xuICAgICAgICAgICAgICBzcXVhcmVuZXNzID0gaW1nLmhlaWdodCAvIGltZy53aWR0aDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBpeGVsQ291bnQgPiAxMDAwICYmIHNxdWFyZW5lc3MgPiAwLjVcbiAgICAgICAgICAgICAgICB8fCAoaW5jbHVkZVNyYyAmJiBpbWFnZVNyYyA9PSBpbmNsdWRlU3JjKSkge1xuICAgICAgICAgICAgICB2YXIgaW1hZ2VJbmRleCA9IGltYWdlQXJyYXkubGVuZ3RoO1xuICAgICAgICAgICAgICBpbWFnZUFycmF5W2ltYWdlSW5kZXhdID0ge307XG4gICAgICAgICAgICAgIGltYWdlQXJyYXlbaW1hZ2VJbmRleF0uc3JjID0gaW1hZ2VTcmM7XG4gICAgICAgICAgICAgIGltYWdlQXJyYXlbaW1hZ2VJbmRleF0uaGVpZ2h0ID0gaW1nLmhlaWdodDtcbiAgICAgICAgICAgICAgaW1hZ2VBcnJheVtpbWFnZUluZGV4XS53aWR0aCA9IGltZy53aWR0aDtcbiAgICAgICAgICAgICAgaW1hZ2VBcnJheVtpbWFnZUluZGV4XS5pZCA9IGltZy5pZDtcbiAgICAgICAgICAgICAgc3Jjc1tpbWFnZVNyY10gPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBzb3J0RnVuYyA9IGZ1bmN0aW9uKGEsYikge1xuICAgICAgICAgICAgICBpZiAoaW5jbHVkZVNyYykge1xuICAgICAgICAgICAgICAgICBpZiAoYS5zcmMgPT0gaW5jbHVkZVNyYyAmJiBiLnNyYyAhPSBpbmNsdWRlU3JjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICBpZiAoYS5zcmMgIT0gaW5jbHVkZVNyYyAmJiBiLnNyYyA9PSBpbmNsdWRlU3JjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIFBhZ2VTY3JhcGVyLnByb3RvdHlwZS5zb3J0SW1hZ2UoYSwgYik7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBpbWFnZUFycmF5LnNvcnQoc29ydEZ1bmMpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vIGdldCBhbGwgaW1hZ2VzIG5lc3RlZCBpbnNpZGUgb2YgYSAnUHJvZHVjdCc7IHRoaXMgdXNlcyB0aGUgbWljcm9kYXRhIFNjaGVtYS5vcmcgdGFnc1xuICAgICAgICAgICAgICB2YXIgaW1nSXRlcmF0b3IgPSBkb2N1bWVudC5ldmFsdWF0ZSgnLy8qW0BpdGVtdHlwZT1cImh0dHA6Ly9zY2hlbWEub3JnL1Byb2R1Y3RcIl0vL2ltZ1tAaXRlbXByb3A9XCJpbWFnZVwiXScsIC8vIHhwYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LCAvLyByb290IG5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVsbCwgLy8gbmFtZXNwYWNlIHJlc29sdmVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFhQYXRoUmVzdWx0Lk9SREVSRURfTk9ERV9JVEVSQVRPUl9UWVBFLCAvLyByZXN1bHQgdHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsKTsgLy8gZXhpc3RpbmcgcmVzdWx0IChzZXQgdG8gbnVsbCBiL2Mgd2Ugd2FudCBhIGZyZXNoIG9iamVjdClcbiAgICAgICAgICAgICAgaWYgKCFpbWdJdGVyYXRvcikge1xuICAgICAgICAgICAgICAgICAgLy8gYmFpbCBpZiBpdCdzIG5vdCBhIHZhbGlkIG9iamVjdFxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGltYWdlQXJyYXk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGN1cnJlbnRJbWc6YW55ID0gaW1nSXRlcmF0b3IuaXRlcmF0ZU5leHQoKTsgIC8vIGluaXRpYWxpemUgdGhlIGl0ZXJhdG9yIHdpdGggdGhlIGZpcnN0IGltYWdlXG4gICAgICAgICAgICAgIHZhciBzY2hlbWFPcmdJbWdBcnJheSA9IFtdOyAgLy8gaW5pdGlhbGl6ZSB3aGVyZSB3ZSdsbCBiZSBob2xkaW5nIG91ciBpbWFnZSBwcm9wZXJ0eSBvYmplY3RzXG4gICAgICAgICAgICAgIHdoaWxlIChjdXJyZW50SW1nKSB7XG4gICAgICAgICAgICAgICAgLy8ga2VlcCBhcHBlbmRpbmcgdGhlIGltYWdlcyAoaW4gdGhlIG9yZGVyIHRoZXkgd2VyZSByZXR1cm5lZDsgdGhpcyBpcyBlbmZvcmNlZCB2aWEgT1JERVJFRF9OT0RFX0lURVJBVE9SX1RZUEUpIGluIHRoZSBzYW1lIGZvcm1hdCBzcGVjaWZpZWQgYWJvdmUuXG4gICAgICAgICAgICAgICAgc2NoZW1hT3JnSW1nQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgICBzcmMgICAgOiBjdXJyZW50SW1nLnNyYyxcbiAgICAgICAgICAgICAgICAgIGhlaWdodCA6IGN1cnJlbnRJbWcuaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgd2lkdGggIDogY3VycmVudEltZy53aWR0aCxcbiAgICAgICAgICAgICAgICAgIGlkICAgICA6IGN1cnJlbnRJbWcuaWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjdXJyZW50SW1nID0gaW1nSXRlcmF0b3IuaXRlcmF0ZU5leHQoKTsgIC8vIGdldCB0aGUgbmV4dCBpbWFnZS5cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBBcnJheS5wcm90b3R5cGUudW5zaGlmdC5hcHBseShpbWFnZUFycmF5LCBzY2hlbWFPcmdJbWdBcnJheSk7IC8vIHRoaXMgd2lsbCBwcmVwZW5kIHRoZSBlbGVtZW50cyBvZiB0aGUgc2Vjb25kIGFycmF5IHRvIHRoZSBmaXJzdCwgbXV0YXRpbmcgdGhlIGZpcnN0LlxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgLy8gbm9vcC5cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGltYWdlQXJyYXk7XG4gICAgfTtcblxuICAgIFBhZ2VTY3JhcGVyLnByb3RvdHlwZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lID0gZnVuY3Rpb24oY2xhc3NOYW1lLCBlbGVtKSB7XG4gICAgICAgICAgZWxlbSA9IGVsZW0gfHwgZG9jdW1lbnQ7XG4gICAgICAgICAgdmFyIG1hdGNoZXMgPSBbXTtcbiAgICAgICAgICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgdmFyIGVsZW1zID0gZWxlbS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBlbGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaChlbGVtc1tpXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBtYXRjaGVzID0gdGhpcy5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lRmFsbGJhY2soY2xhc3NOYW1lLCBlbGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmKGRvY3VtZW50LmV2YWx1YXRlKSB7XG4gICAgICAgICAgICB2YXIgbm9kZTtcbiAgICAgICAgICAgIC8vIEJJVCBjaGFuZ2VzOiBhZGQgdHlwZSBkZWNsYXJhdGlvbiBzaW5jZSB3ZSBuZWVkIHRvIGluY2x1ZGVkIGluIFRTIGFuZCBjb21waWxlIGl0XG4gICAgICAgICAgICB2YXIgZWxlbXM6YW55ID0gZG9jdW1lbnQuZXZhbHVhdGUoXCIuLy8qW2NvbnRhaW5zKGNvbmNhdCgnICcsIEBjbGFzcywgJyAnKSwnIFwiICsgY2xhc3NOYW1lICsgXCIgJyldXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtLCBudWxsLCAwLCBudWxsKTtcbiAgICAgICAgICAgIHdoaWxlIChub2RlID0gZWxlbXMuaXRlcmF0ZU5leHQoKSkge1xuICAgICAgICAgICAgICBtYXRjaGVzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hlcztcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBtYXRjaGVzID0gdGhpcy5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lRmFsbGJhY2soY2xhc3NOYW1lLCBlbGVtKTtcbiAgICAgICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgICAgICAgIH1cbiAgICB9O1xuXG4gICAgUGFnZVNjcmFwZXIucHJvdG90eXBlLmdldEVsZW1lbnRzQnlDbGFzc05hbWVGYWxsYmFjayA9IGZ1bmN0aW9uKGNsYXNzTmFtZSwgZWxlbSkge1xuICAgICAgICAgIHZhciBtYXRjaGVzID0gW10sXG4gICAgICAgICAgICAgIGVsZW1zID0gZWxlbS5nZXRFbGVtZW50c0J5VGFnTmFtZShcIipcIiksXG4gICAgICAgICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChcIihefFxcXFxzKVwiICsgY2xhc3NOYW1lICsgXCIoXFxcXHN8JClcIik7XG5cbiAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGVsZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGlmKHJlZ2V4LnRlc3QoZWxlbXNbaV0uY2xhc3NOYW1lKSkge1xuICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaChlbGVtc1tpXSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgIH07XG5cblxuICAgIFBhZ2VTY3JhcGVyLnByb3RvdHlwZS5leHRyYWN0VmFsdWUgPSBmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgICAgaWYgKGVsZW0ubm9kZU5hbWUgPT0gXCJJTUdcIiB8fCBlbGVtLm5vZGVOYW1lID09IFwiSUZSQU1FXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBlbGVtLnNyYztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVsZW0ubm9kZU5hbWUgPT0gXCJJTlBVVFwiKSB7XG4gICAgICAgICAgICByZXR1cm4gZWxlbS52YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGVsZW0uaW5uZXJIVE1MO1xuICAgIH07XG5cbiAgICBQYWdlU2NyYXBlci5wcm90b3R5cGUucGFyc2VHZW5lcmljVmVuZG9yRGF0YSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBwb3N0Zml4ID0gJyc7XG4gICAgICAgICAgaWYgKHBhZ2VBcmdzICYmIHBhZ2VBcmdzLm5hbWUpIHtcbiAgICAgICAgICAgIHBvc3RmaXggPSAnLicgKyBwYWdlQXJncy5uYW1lO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBfb2JqZWN0ID0gbnVsbDtcbiAgICAgICAgICB2YXIgb2JqID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICBpZiAoX29iamVjdCl7IHJldHVybiBfb2JqZWN0O31cbiAgICAgICAgICAgICAgX29iamVjdCA9IG5ldyBPYmplY3QoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIF9vYmplY3Q7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIGJrSGlkZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdBVVdMQmtIaWRlJyArIHBvc3RmaXgpO1xuICAgICAgICAgIGlmIChia0hpZGUgJiYgYmtIaWRlLmlubmVySFRNTCAmJiBia0hpZGUuaW5uZXJIVE1MLmxlbmd0aCAmJiBpc0JLTUxvY2FsRG9tYWluKCkpIHtcbiAgICAgICAgICAgICAgb2JqKCkuaGlkZSA9IGJrSGlkZS5pbm5lckhUTUw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBia1RpdGxlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ0FVV0xCa1RpdGxlJyArIHBvc3RmaXgpO1xuICAgICAgICAgIGlmIChia1RpdGxlKXtcbiAgICAgICAgICAgICAgb2JqKCkudGl0bGUgPSBia1RpdGxlLmlubmVySFRNTDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGJrUHJpY2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnQVVXTEJrUHJpY2UnICsgcG9zdGZpeCk7XG4gICAgICAgICAgdmFyIGJrUHJpY2VMb3cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnQVVXTEJrUHJpY2VMb3cnICsgcG9zdGZpeCk7XG4gICAgICAgICAgdmFyIGJrUHJpY2VIaWdoID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ0FVV0xCa1ByaWNlSGlnaCcgKyBwb3N0Zml4KTtcbiAgICAgICAgICB2YXIgYmtDdXJyZW5jeSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdBVVdMQmtDdXJyZW5jeScgKyBwb3N0Zml4KTtcbiAgICAgICAgICBpZiAoYmtQcmljZSAmJiBia1ByaWNlLmlubmVySFRNTCAmJiBia1ByaWNlLmlubmVySFRNTC5sZW5ndGgpe1xuICAgICAgICAgICAgICBvYmooKS5wcmljZSA9IGJrUHJpY2UuaW5uZXJIVE1MO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYmtQcmljZUxvdyAmJiBia1ByaWNlTG93LmlubmVySFRNTCAmJiBia1ByaWNlTG93LmlubmVySFRNTC5sZW5ndGhcbiAgICAgICAgICAgICAgICAgICYmIGJrUHJpY2VIaWdoICYmIGJrUHJpY2VIaWdoLmlubmVySFRNTCAmJiBia1ByaWNlSGlnaC5pbm5lckhUTUwubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIG9iaigpLnByaWNlID0gYmtQcmljZUxvdy5pbm5lckhUTUw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChia0N1cnJlbmN5ICYmIGJrQ3VycmVuY3kuaW5uZXJIVE1MICYmIGJrQ3VycmVuY3kuaW5uZXJIVE1MLmxlbmd0aCkge1xuICAgICAgICAgICAgb2JqKCkuY3VycmVuY3kgPSBia0N1cnJlbmN5LmlubmVySFRNTDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGJrSW1hZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnQVVXTEJrSW1hZ2UnICsgcG9zdGZpeCk7XG4gICAgICAgICAgaWYgKGJrSW1hZ2Upe1xuICAgICAgICAgICAgb2JqKCkuaW1hZ2VBcnJheSA9IFsge1xuICAgICAgICAgICAgICBcInNyY1wiIDogYmtJbWFnZS5pbm5lckhUTUxcbiAgICAgICAgICAgIH1dO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgYmtVUkwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnQVVXTEJrVVJMJyArIHBvc3RmaXgpO1xuICAgICAgICAgIGlmIChia1VSTCl7XG4gICAgICAgICAgICAgIG9iaigpLnVybCA9IGJrVVJMLmlubmVySFRNTDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoYmtQYWdlVmVyc2lvbikge1xuICAgICAgICAgICAgdmFyIHZlcnNpb24gPSBwYXJzZUludChia1BhZ2VWZXJzaW9uLmlubmVySFRNTCk7XG4gICAgICAgICAgICBvYmooKS52ZXJzaW9uID0gdmVyc2lvbjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgYmtCYW5uZXJJbWFnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdBVVdMQmtCYW5uZXJJbWFnZScgKyBwb3N0Zml4KTtcbiAgICAgICAgICB2YXIgaXNBbWF6b24gPSBpc0JLTVNvdXJjZURvbWFpbigpO1xuICAgICAgICAgIGlmKGJrQmFubmVySW1hZ2UgJiYgaXNBbWF6b24pIHtcbiAgICAgICAgICAgIG9iaigpLmJhbm5lckltYWdlID0gYmtCYW5uZXJJbWFnZS5pbm5lckhUTUw7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIF9vYmplY3Q7XG4gICAgfTtcblxuICAgIFBhZ2VTY3JhcGVyLnByb3RvdHlwZS5wYXJzZUFtYXpvblZlbmRvckRhdGEgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICAgIHZhciBpdGVtRGF0YTphbnkgPSBuZXcgT2JqZWN0KCk7IC8vIEJJVCBjaGFuZ2VzOiBhZGQgdHlwZSBkZWNsYXJhdGlvbiBzaW5jZSB3ZSBuZWVkIHRvIGluY2x1ZGVkIGluIFRTIGFuZCBjb21waWxlIGl0XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgaXRlbURhdGEudGl0bGUgPSBkb2N1bWVudC50aXRsZTtcbiAgICAgICAgICAgIGlmKHR5cGVvZiBpdGVtRGF0YS50aXRsZSAhPSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgIGl0ZW1EYXRhLnRpdGxlID0gXCJcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHZhciB0aXRsZUJsb2NrID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0QXNpblRpdGxlJyk7XG4gICAgICAgICAgICAgIGlmICh0aXRsZUJsb2NrKSB7XG4gICAgICAgICAgICAgICAgaXRlbURhdGEudGl0bGUgPSB0aXRsZUJsb2NrLmlubmVyVGV4dCB8fCB0aXRsZUJsb2NrLnRleHRDb250ZW50O1xuICAgICAgICAgICAgICAgIGlmIChpdGVtRGF0YS50aXRsZSkge1xuICAgICAgICAgICAgICAgICAgaXRlbURhdGEudGl0bGUgPSBpdGVtRGF0YS50aXRsZS5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCBcIlwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2goZSkge31cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGl0ZW1EYXRhLmFzaW4gPSAoPGFueT5kb2N1bWVudCkuaGFuZGxlQnV5LkFTSU4udmFsdWU7IC8vIEJJVCBjaGFuZ2VzOiBhZGQgdHlwZSBkZWNsYXJhdGlvbiBzaW5jZSB3ZSBuZWVkIHRvIGluY2x1ZGVkIGluIFRTIGFuZCBjb21waWxlIGl0XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdmFyIGFzaW5GaWVsZE5hbWVzID0ge0FTSU46IDEsIGFzaW46IDEsIG9fYXNpbjogMX07XG4gICAgICAgICAgICAgICAgYXNpbkZpZWxkTmFtZXNbJ0FTSU4uMCddID0gMTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBhc2luRmllbGQgaW4gYXNpbkZpZWxkTmFtZXMpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBhc2lucyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKGFzaW5GaWVsZCk7XG4gICAgICAgICAgICAgICAgICBpZiAoYXNpbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW1EYXRhLmFzaW4gPSAoPGFueT5hc2luc1swXSkudmFsdWU7IC8vIEJJVCBjaGFuZ2VzOiBhZGQgdHlwZSBkZWNsYXJhdGlvbiBzaW5jZSB3ZSBuZWVkIHRvIGluY2x1ZGVkIGluIFRTIGFuZCBjb21waWxlIGl0XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge31cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBjaGVja1RhZ3MgPSBuZXcgQXJyYXkoXCJiXCIsIFwic3BhblwiKTtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5ldmFsdWF0ZSkge1xuICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGkgPCBjaGVja1RhZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBCSVQgY2hhbmdlczogYWRkIHR5cGUgZGVjbGFyYXRpb24gc2luY2Ugd2UgbmVlZCB0byBpbmNsdWRlZCBpbiBUUyBhbmQgY29tcGlsZSBpdFxuICAgICAgICAgICAgICAgIHZhciBlbHRzOmFueSA9IGRvY3VtZW50LmV2YWx1YXRlKFwiLy9kaXZbQGlkPSdwcmljZUJsb2NrJ10vL3RhYmxlW0BjbGFzcz0ncHJvZHVjdCddLy90ZC8vXCIgKyBjaGVja1RhZ3NbaV0gKyBcIltjb250YWlucyhAY2xhc3MsJ3ByaWNlTGFyZ2UnKSBvciBjb250YWlucyhAY2xhc3MsJ3ByaWNlJykgb3IgY29udGFpbnMoQGNsYXNzLCdwYV9wcmljZScpXVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudCwgbnVsbCwgNSwgbnVsbCk7XG4gICAgICAgICAgICAgICAgdmFyIGVsdCA9IG51bGw7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGVsdCA9IGVsdHMuaXRlcmF0ZU5leHQoKSkge1xuICAgICAgICAgICAgICAgICAgaWYgKGVsdC50ZXh0Q29udGVudCkge1xuICAgICAgICAgICAgICAgICAgICBpdGVtRGF0YS5wcmljZSA9IGVsdC50ZXh0Q29udGVudDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChpdGVtRGF0YS5wcmljZSkgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHZhciBwcmljZUJsb2NrID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ByaWNlQmxvY2snKTtcbiAgICAgICAgICAgICAgaWYgKHByaWNlQmxvY2spIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFibGVzID0gcHJpY2VCbG9jay5nZXRFbGVtZW50c0J5VGFnTmFtZSgndGFibGUnKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGkgPCB0YWJsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgIHZhciB0YWJsZUNsYXNzID0gdGFibGVzW2ldLmdldEF0dHJpYnV0ZSgnY2xhc3MnKSB8fCB0YWJsZXNbaV0uZ2V0QXR0cmlidXRlKCdjbGFzc05hbWUnKTtcbiAgICAgICAgICAgICAgICAgIGlmICh0YWJsZUNsYXNzID09ICdwcm9kdWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBqPTA7IGkgPCBjaGVja1RhZ3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgZWxlbWVudHMgPSB0YWJsZXNbaV0uZ2V0RWxlbWVudHNCeVRhZ05hbWUoY2hlY2tUYWdzW2pdKTtcbiAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBCSVQgY2hhbmdlczogYWRkIHR5cGUgZGVjbGFyYXRpb24gc2luY2Ugd2UgbmVlZCB0byBpbmNsdWRlZCBpbiBUUyBhbmQgY29tcGlsZSBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVsZW1lbnRDbGFzcyA9ICg8YW55PmVsZW1lbnRzW2ldKS5nZXRBdHRyaWJ1dGUoJ2NsYXNzJykgfHwgKDxhbnk+ZWxlbWVudHNbaV0pLmdldEF0dHJpYnV0ZSgnY2xhc3NOYW1lJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbWVudENsYXNzLmluZGV4T2YoJ3ByaWNlJykgPiAtMSB8fCBlbGVtZW50Q2xhc3MuaW5kZXhPZigncHJpY2VMYXJnZScpID4gLTEgfHwgZWxlbWVudENsYXNzLmluZGV4T2YoJ3BhX3ByaWNlJykgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtRGF0YS5wcmljZSA9ICg8YW55PmVsZW1lbnRzW2ldKS5pbm5lckhUTUw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbURhdGEucHJpY2UpIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpdGVtRGF0YSAmJiBpdGVtRGF0YS5wcmljZSkge1xuICAgICAgICAgICAgICB2YXIgcHJpY2VQYXJ0cyA9IGl0ZW1EYXRhLnByaWNlLnNwbGl0KFwiLVwiKTtcbiAgICAgICAgICAgICAgaWYocHJpY2VQYXJ0c1swXSl7XG4gICAgICAgICAgICAgICAgaXRlbURhdGEucHJpY2UgPSBwcmljZVBhcnRzWzBdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaXRlbURhdGEgJiYgIWl0ZW1EYXRhLnByaWNlKSB7XG4gICAgICAgICAgICAgIGl0ZW1EYXRhLnByaWNlID0gdGhpcy5nZXRQcmljZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgaW1hZ2VDZWxsTmFtZXMgPSB7cHJvZEltYWdlQ2VsbDogMSwgZmlvbmFfaW50cm9fbm9mbGFzaDogMSwgcHJvZHVjdGhlYWRlcjogMSwgJ2tpYi1tYS1jb250YWluZXItMSc6IDEsICdjZW50ZXItMTJfZmVhdHVyZV9kaXYnOiAxLCBob2xkZXJNYWluSW1hZ2U6IDEsICdtYWluLWltYWdlLW91dGVyLXdyYXBwZXInOiAxLCAnbWFpbi1pbWFnZS1jb250YWluZXInOiAxfTtcbiAgICAgICAgICAgIHZhciBzZWxlY3RlZEltYWdlO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpbWFnZUNlbGwgaW4gaW1hZ2VDZWxsTmFtZXMpIHtcbiAgICAgICAgICAgICAgdmFyIHByb2RJbWFnZUNlbGwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpbWFnZUNlbGwpO1xuICAgICAgICAgICAgICBpZiAocHJvZEltYWdlQ2VsbCkge1xuICAgICAgICAgICAgICAgIHZhciBwcm9kSW1hZ2VzID0gcHJvZEltYWdlQ2VsbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW1nJyk7XG4gICAgICAgICAgICAgICAgaWYgKHByb2RJbWFnZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgcHJvZEltYWdlQXJyYXkgPSBuZXcgQXJyYXkocHJvZEltYWdlcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9kSW1hZ2VzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgICAgICAgICAgIHByb2RJbWFnZUFycmF5LnB1c2gocHJvZEltYWdlc1tpXSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBwcm9kSW1hZ2VBcnJheS5zb3J0KHRoaXMuc29ydEltYWdlKTtcbiAgICAgICAgICAgICAgICAgIHNlbGVjdGVkSW1hZ2UgPSBwcm9kSW1hZ2VBcnJheVswXTtcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2VsZWN0ZWRJbWFnZSkge1xuICAgICAgICAgICAgICBpdGVtRGF0YS5pbWFnZUFycmF5ID0gW3tcbiAgICAgICAgICAgICAgICBcInNyY1wiIDogc2VsZWN0ZWRJbWFnZS5zcmMsXG4gICAgICAgICAgICAgICAgXCJoZWlnaHRcIiA6IHNlbGVjdGVkSW1hZ2UuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIFwid2lkdGhcIiA6IHNlbGVjdGVkSW1hZ2Uud2lkdGhcbiAgICAgICAgICAgICAgfV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAoIGl0ZW1EYXRhICYmICFpdGVtRGF0YS5hc2luKSB7XG4gICAgICAgICAgICAgICAgaXRlbURhdGEuaW1hZ2VBcnJheSA9IHRoaXMuZ2V0R2VuZXJpY0ltYWdlRGF0YSgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaChlKSB7fVxuXG4gICAgICAgICAgaWYoIWl0ZW1EYXRhLmltYWdlQXJyYXkpIHtcbiAgICAgICAgICAgICBpdGVtRGF0YS5pbWFnZUFycmF5ID0gW107XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBpdGVtRGF0YTtcbiAgICB9O1xuXG4gICAgUGFnZVNjcmFwZXIucHJvdG90eXBlLnBhcnNlR29vZ2xlQ2hlY2tvdXRWZW5kb3JEYXRhID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICB2YXIgaXRlbURhdGEgPSBudWxsO1xuXG4gICAgICAgIHZhciBlbGVtcyA9IHRoaXMuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcInByb2R1Y3RcIik7XG5cbiAgICAgICAgICBpZiAoZWxlbXMgJiYgZWxlbXNbMF0pIHtcbiAgICAgICAgICAgIGl0ZW1EYXRhID0ge307XG4gICAgICAgICAgICBpdGVtRGF0YS51bnZlcmlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciBwcm9kID0gZWxlbXNbMF07XG4gICAgICAgICAgICB2YXIgc2NyYXBlZEltYWdlO1xuXG4gICAgICAgICAgICB2YXIgdGl0bGVFbGVtID0gdGhpcy5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwicHJvZHVjdC10aXRsZVwiLCBwcm9kKTtcbiAgICAgICAgICAgIGlmKHRpdGxlRWxlbSAmJiB0aXRsZUVsZW1bMF0pIHtcbiAgICAgICAgICAgICAgaXRlbURhdGEudGl0bGUgPSB0aGlzLmV4dHJhY3RWYWx1ZSh0aXRsZUVsZW1bMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHByaWNlRWxlbSA9IHRoaXMuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcInByb2R1Y3QtcHJpY2VcIiwgcHJvZCk7XG4gICAgICAgICAgICBpZihwcmljZUVsZW0gJiYgcHJpY2VFbGVtWzBdKSB7XG4gICAgICAgICAgICAgIGl0ZW1EYXRhLnByaWNlID0gdGhpcy5leHRyYWN0VmFsdWUocHJpY2VFbGVtWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB1cmxFbGVtID0gdGhpcy5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwicHJvZHVjdC11cmxcIiwgcHJvZCk7XG4gICAgICAgICAgICBpZih1cmxFbGVtICYmIHVybEVsZW1bMF0pIHtcbiAgICAgICAgICAgICAgaXRlbURhdGEudXJsID0gdGhpcy5leHRyYWN0VmFsdWUodXJsRWxlbVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgaW1nRWxlbSA9IHRoaXMuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcInByb2R1Y3QtaW1hZ2VcIiwgcHJvZCk7XG4gICAgICAgICAgICBpZiAoaW1nRWxlbSAmJiBpbWdFbGVtWzBdKSB7XG4gICAgICAgICAgICAgIHZhciBpbWdTcmMgPSB0aGlzLmV4dHJhY3RWYWx1ZShpbWdFbGVtWzBdKTtcbiAgICAgICAgICAgICAgc2NyYXBlZEltYWdlID0gaW1nU3JjO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpdGVtRGF0YS5pbWFnZUFycmF5ID0gdGhpcy5nZXRHZW5lcmljSW1hZ2VEYXRhKHNjcmFwZWRJbWFnZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYoaXRlbURhdGEgJiYgaXRlbURhdGEudGl0bGUgJiYgaXRlbURhdGEucHJpY2UpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGl0ZW1EYXRhO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH1cbiAgICB9O1xuXG4gICAgUGFnZVNjcmFwZXIucHJvdG90eXBlLmdldFRpdGxlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdGl0bGUgPSAvKndpbmRvdy4qL2RvY3VtZW50LnRpdGxlOyAvLyBCSVQgY2hhbmdlczogdXNlIGRvY3VtZW50IGluc3RlYWQgb2Ygd2luZG93XG4gICAgICBpZih0eXBlb2YgdGl0bGUgIT0gXCJzdHJpbmdcIikge1xuICAgICAgICByZXR1cm4gXCJcIjtcbiAgICAgIH1cblxuICAgICAgdGl0bGUgPSB0aXRsZS5yZXBsYWNlKC9cXHMrL2csJyAnKTtcbiAgICAgIHRpdGxlID0gdGl0bGUucmVwbGFjZSgvXlxccyp8XFxzKiQvZywnJyk7XG5cbiAgICAgIGlmKGRvY3VtZW50LmRvbWFpbi5tYXRjaCgvYW1hem9uXFwuY29tLykgJiYgYXNpbil7XG4gICAgICAgIHZhciB0aXRsZVBhcnRzID0gdGl0bGUuc3BsaXQoXCI6XCIpO1xuICAgICAgICBpZih0aXRsZVBhcnRzWzFdKXtcbiAgICAgICAgICB0aXRsZSA9IHRpdGxlUGFydHNbMV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aXRsZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQYWdlU2NyYXBlcigpO1xuICAgIH07XG59XG4iXX0=