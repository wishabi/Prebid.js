import * as utils from 'src/utils';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER } from '../src/mediaTypes.js';
const KEVEL_NETWORK_ID = 11090;
const BIDDER_CODE = 'flipp';
const ENDPOINT_URL = 'https://gateflipp-stg.flippback.com/flyer-locator-service-stg/campaigns';
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
     * @param {validBidRequests[]} - an array of bids
     * @return ServerRequest Info describing the request to the server.
     */
  buildRequests: function(validBidRequests) {
    return validBidRequests.map(bid => (
      {
        method: 'POST',
        url: ENDPOINT_URL,
        data: {
          placements: [
            {
              divName: bid.code,
              networkId: KEVEL_NETWORK_ID,
            }
          ]
        },
      }
    ))[0];
  },
  /**
     * Unpack the response from the server into a list of bids.
     *
     * @param {ServerResponse} serverResponse A successful response from the server.
     * @return {Bid[]} An array of bids which were nested inside the server.
     */
  interpretResponse: function(serverResponse, bidRequest) {
    // const serverBody  = serverResponse.body;
    // const headerValue = serverResponse.headers.get('some-response-header');
    const bidResponses = [];
    const bidResponse = {
      requestId: bidRequest.bidId,
      cpm: CPM,
      width: WIDTH,
      height: HEIGHT,
      creativeId: CREATIVE_ID,
      dealId: DEAL_ID,
      currency: CURRENCY,
      netRevenue: true,
      ttl: TIME_TO_LIVE,
      referrer: REFERER,
      ad: CREATIVE_BODY
    };
    bidResponses.push(bidResponse);
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
