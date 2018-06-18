// Utility functions to work with Watson Work Webhook events
import debug from 'debug';

// Setup debug log
const log = debug('watsonwork-weather-events');

export const onActionSelected = (evt, appId, cb) => {
  if (evt.type === 'message-annotation-added' &&
    evt.annotationType === 'actionSelected') {
    const annotationPayload = JSON.parse(evt.annotationPayload);
    // make sure this message is for us
    if (annotationPayload.targetAppId === appId && annotationPayload.actionId) {
      log('Identified action selected %o', annotationPayload);
      cb(annotationPayload.actionId, annotationPayload, evt.userId);
    }
  }
};
