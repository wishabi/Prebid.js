import {isEmpty, parseUrl, triggerPixel} from '../src/utils.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER } from '../src/mediaTypes.js';
import {getStorageManager} from '../src/storageManager.js';

const NETWORK_ID = 11090;
const AD_TYPES = [4309, 641];
const DTX_TYPES = [5061];
const TARGET_NAME = 'inline';
const BIDDER_CODE = 'flipp';
const ENDPOINT = 'https://gateflipp.flippback.com/flyer-locator-service/prebid_campaigns';
const DEFAULT_TTL = 30;
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_CREATIVE_TYPE = 'NativeX';
const VALID_CREATIVE_TYPES = ['DTX', 'NativeX'];

let userKey = null;
let cookieSynced = false;
export const storage = getStorageManager({bidderCode: BIDDER_CODE});

const syncUserKey = (userKey) => {
  if (!cookieSynced) {
    triggerPixel(`https://idsync.rlcdn.com/712559.gif?partner_uid=${userKey}`);
    cookieSynced = true;
  }
};

export function getUserKey(options = {}) {
  if (userKey) {
    syncUserKey(userKey);
    return userKey;
  }

  // If the partner provides the user key use it, otherwise fallback to cookies
  if ('userKey' in options && options.userKey) {
    if (isValidUserKey(options.userKey)) {
      userKey = options.userKey;
      syncUserKey(userKey);
      return options.userKey;
    }
  }

  const FLIPP_USER_KEY = 'flipp-uid';

  // Grab from Cookie
  const foundUserKey = storage.cookiesAreEnabled() && storage.getCookie(FLIPP_USER_KEY);
  if (foundUserKey) {
    syncUserKey(foundUserKey);
    return foundUserKey;
  }

  // Generate if none found
  userKey = generateUUID();

  if (!userKey) {
    return null;
  }

  // Set cookie
  if (storage.cookiesAreEnabled()) {
    storage.setCookie(FLIPP_USER_KEY, userKey);
  }

  syncUserKey(userKey);
  return userKey;
}

function isValidUserKey(userKey) {
  return !userKey.startsWith('#');
}

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Determines if a creativeType is valid
 *
 * @param {string} creativeType The Creative Type to validate.
 * @return string creativeType if this is a valid Creative Type, and 'NativeX' otherwise.
 */
const validateCreativeType = (creativeType) => {
  if (creativeType && VALID_CREATIVE_TYPES.includes(creativeType)) {
    return creativeType;
  } else {
    return DEFAULT_CREATIVE_TYPE;
  }
};

const getAdTypes = (creativeType) => {
  if (creativeType === 'DTX') {
    return DTX_TYPES;
  }
  return AD_TYPES;
}

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [BANNER],
  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {BidRequest} bid The bid params to validate.
   * @return boolean True if this is a valid bid, and false otherwise.
   */
  isBidRequestValid: function(bid) {
    return !!(bid.params.siteId) && !!(bid.params.publisherNameIdentifier);
  },
  /**
   * Make a server request from the list of BidRequests.
   *
   * @param {BidRequest[]} validBidRequests[] an array of bids
   * @param {BidderRequest} bidderRequest master bidRequest object
   * @return ServerRequest Info describing the request to the server.
   */
  buildRequests: function(validBidRequests, bidderRequest) {
    const urlParams = parseUrl(bidderRequest.refererInfo.page).search;
    const contentCode = urlParams['flipp-content-code'];
    const userKey = getUserKey(validBidRequests[0]?.params);
    const placements = validBidRequests.map((bid, index) => {
      return {
        divName: TARGET_NAME,
        networkId: NETWORK_ID,
        siteId: bid.params.siteId,
        adTypes: getAdTypes(bid.params.creativeType),
        count: 1,
        ...(!isEmpty(bid.params.zoneIds) && {zoneIds: bid.params.zoneIds}),
        properties: {
          ...(!isEmpty(contentCode) && {contentCode: contentCode.slice(0, 32)}),
        },
        prebid: {
          requestId: bid.bidId,
          publisherNameIdentifier: bid.params.publisherNameIdentifier,
          height: bid.mediaTypes.banner.sizes[index][0],
          width: bid.mediaTypes.banner.sizes[index][1],
          creativeType: validateCreativeType(bid.params.creativeType),
        }
      }
    });
    return {
      method: 'POST',
      url: ENDPOINT,
      data: {
        placements,
        url: bidderRequest.refererInfo.page,
        user: {
          key: userKey,
        },
      },
    }
  },
  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {ServerResponse} serverResponse A successful response from the server.
   * @param {BidRequest} bidRequest A bid request object
   * @return {Bid[]} An array of bids which were nested inside the server.
   */
  interpretResponse: function(serverResponse, bidRequest) {
    if (!serverResponse?.body) return [];
    const res = serverResponse.body;
    if (!isEmpty(res) && !isEmpty(res.decisions) && !isEmpty(res.decisions.inline)) {
      return res.decisions.inline.map(decision => ({
        bidderCode: BIDDER_CODE,
        requestId: decision.prebid?.requestId,
        cpm: decision.prebid?.cpm,
        width: decision.width,
        height: decision.height,
        creativeId: decision.adId,
        currency: DEFAULT_CURRENCY,
        netRevenue: true,
        ttl: DEFAULT_TTL,
        ad: decision.prebid?.creative,
      }));
    }
    return [];
  },

  /**
   * Register the user sync pixels which should be dropped after the auction.
   *
   * @param {SyncOptions} syncOptions Which user syncs are allowed?
   * @param {ServerResponse[]} serverResponses List of server's responses.
   * @return {UserSync[]} The user syncs which should be dropped.
   */
  getUserSyncs: (syncOptions, serverResponses) => [],
}
registerBidder(spec);
