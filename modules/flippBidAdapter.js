import { isEmpty } from '../src/utils.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER } from '../src/mediaTypes.js';
const NETWORK_ID = 11090;
const AD_TYPES = [4309, 641];
const TARGET_NAME = 'inline';
const BIDDER_CODE = 'flipp';
// const ENDPOINT_URL = 'http://localhost:7000';
const ENDPOINT_URL = 'https://gateflipp-stg.flippback.com/flyer-locator-service-stg/prebid_campaigns';
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

function makeCreative(res) {
  const campaignJSON = JSON.stringify(res).replaceAll('<script></script>', '');

  return (`
            <head>
                <script async src="snippet/flipptag.js"></script>
                <script>
                    var campaignsResponse = ${campaignJSON};
                    window.flippxp = window.flippxp || { run: [] };
                    window.flippxp.run.push(function () {
                    window.flippxp.registerSlot(
                        '#flipp-scroll-ad-content',
                        'wishabi-test-publisher',
                        1192075,
                        [260678],
                     {
                          nestedIframe: true,
                          nestedIframeFullBleed: true,
                          isGoogleAdManager: true,
                       compactHeight: 600,
                        startCompact: true,
                        dwellExpandable: true,
                        experienceLimit: 1,
                        prebid: {},
                        campaigns: campaignsResponse
                        },
                      );
                    });
                 </script>
            </head>

            <body style="margin: 0">
                <div id="flipp-scroll-ad-content"></div>
            </body>
        `);
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
    return validBidRequests.map((bid, index) => (
      {
        method: 'POST',
        url: ENDPOINT_URL,
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
                ...(!isEmpty(bid.params.contentCode) && {contentCode: bid.params.contentCode.slice(0, 32)}),
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
      }
    ))[0];
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
      const creative = res.prebid?.creative || makeCreative(res);
      const decision = res.decisions.inline[0];
      const cpm = res.prebid?.cpm || DEFAULT_CPM;
      const bidResponse = {
        requestId: bidRequest.bidId,
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
