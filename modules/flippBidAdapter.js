import {isEmpty, parseUrl} from '../src/utils.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER } from '../src/mediaTypes.js';
const NETWORK_ID = 11090;
const AD_TYPES = [4309, 641];
const TARGET_NAME = 'inline';
const BIDDER_CODE = 'flipp';
const ENDPOINT_DEV = 'http://127.0.0.1:7000/prebid_campaigns';
const ENDPOINT_STAGING = 'https://gateflipp-stg.flippback.com/flyer-locator-service-stg/prebid_campaigns';
const ENDPOINT_PRODUCTION = 'https://gateflipp.flippback.com/flyer-locator-service/prebid_campaigns';
const DEFAULT_CPM = 1;
const DEFAULT_TTL = 30;
const DEFAULT_CURRENCY = 'USD';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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
    return !!(bid.params.siteId);
  },
  /**
     * Make a server request from the list of BidRequests.
     *
     * @param {BidRequest[]} validBidRequests[] an array of bids
     * @param {BidderRequest} bidderRequest master bidRequest object
     * @return ServerRequest Info describing the request to the server.
     */
  buildRequests: function(validBidRequests, bidderRequest) {
    return validBidRequests.map((bid, index) => {
      const urlParams = parseUrl(bidderRequest.refererInfo.page).search;
      let endpoint = ENDPOINT_PRODUCTION;
      if (urlParams['pb-env'] === 'dev') endpoint = ENDPOINT_DEV;
      if (urlParams['pb-env'] === 'staging') endpoint = ENDPOINT_STAGING;
      const contentCode = urlParams['flipp-content-code'];
      return {
        method: 'POST',
        url: endpoint,
        data: {
          placements: [
            {
              divName: TARGET_NAME,
              networkId: NETWORK_ID,
              siteId: bid.params.siteId,
              adTypes: AD_TYPES,
              count: 1,
              ...(!isEmpty(bid.params.zoneIds) && {zoneIds: bid.params.zoneIds}),
              properties: {
                ...(!isEmpty(contentCode) && {contentCode: contentCode.slice(0, 32)}),
              },
            }
          ],
          url: bidderRequest.refererInfo.page,
          user: {key: isEmpty(bid.params.userKey) ? generateUUID() : bid.params.userKey},
          prebid: {
            requestId: bid.bidId,
            publisherNameIdentifier: bid.params.publisherNameIdentifier,
            height: bid.mediaTypes.banner.sizes[index][0],
            width: bid.mediaTypes.banner.sizes[index][1],
          }
        },
      };
    })
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
    const bidResponses = [];
    if (!isEmpty(res) && !isEmpty(res.decisions) && !isEmpty(res.decisions.inline)) {
      const decision = res.decisions.inline[0];
      const creative = decision.prebid?.creative;
      const cpm = res.prebid?.cpm || DEFAULT_CPM;
      const bidResponse = {
        requestId: bidRequest.data.prebid.requestId,
        cpm,
        width: bidRequest.data.prebid.width,
        height: bidRequest.data.prebid.height,
        creativeId: decision.adId,
        currency: DEFAULT_CURRENCY,
        netRevenue: true,
        ttl: DEFAULT_TTL,
        ad: creative,
      };
      bidResponses.push(bidResponse);
    }
    return bidResponses;
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
