/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import _ from 'lodash';
import React from 'react';
import { Provider } from 'react-redux';
import { render, unmountComponentAtNode } from 'react-dom';
import 'mapbox-gl/dist/mapbox-gl.css';

import { Embeddable } from 'ui/embeddable';
import { I18nContext } from 'ui/i18n';

import { GisMap } from '../components/gis_map';
import { createMapStore } from '../store/store';
import { getInitialLayers } from '../angular/get_initial_layers';
import {
  setGotoWithCenter,
  replaceLayerList,
  setQuery,
  setRefreshConfig,
} from '../actions/store_actions';
import { setReadOnly } from '../store/ui';
import { getInspectorAdapters } from '../store/non_serializable_instances';

export class MapEmbeddable extends Embeddable {

  constructor({ savedMap, editUrl, indexPatterns = [] }) {
    super({ title: savedMap.title, editUrl, indexPatterns });

    this._savedMap = savedMap;
    this._store = createMapStore();
  }

  getInspectorAdapters() {
    return getInspectorAdapters(this._store.getState());
  }

  onContainerStateChanged(containerState) {
    if (!_.isEqual(containerState.timeRange, this._prevTimeRange) ||
        !_.isEqual(containerState.query, this._prevQuery) ||
        !_.isEqual(containerState.filters, this._prevFilters)) {
      this._dispatchSetQuery(containerState);
    }

    if (!_.isEqual(containerState.refreshConfig, this._prevRefreshConfig)) {
      this._dispatchSetRefreshConfig(containerState);
    }
  }

  _dispatchSetQuery({ query, timeRange, filters }) {
    this._prevTimeRange = timeRange;
    this._prevQuery = query;
    this._prevFilters = filters;
    this._store.dispatch(setQuery({
      filters: filters.filter(filter => !filter.meta.disabled),
      query,
      timeFilters: timeRange,
    }));
  }

  _dispatchSetRefreshConfig({ refreshConfig }) {
    this._prevRefreshConfig = refreshConfig;
    this._store.dispatch(setRefreshConfig(refreshConfig));
  }

  /**
   *
   * @param {HTMLElement} domNode
   * @param {ContainerState} containerState
   */
  render(domNode, containerState) {
    this._store.dispatch(setReadOnly(true));
    // todo get center and zoom from embeddable UI state
    if (this._savedMap.mapStateJSON) {
      const mapState = JSON.parse(this._savedMap.mapStateJSON);
      this._store.dispatch(setGotoWithCenter({
        lat: mapState.center.lat,
        lon: mapState.center.lon,
        zoom: mapState.zoom,
      }));
    }
    const layerList = getInitialLayers(this._savedMap.layerListJSON);
    this._store.dispatch(replaceLayerList(layerList));
    this._dispatchSetQuery(containerState);
    this._dispatchSetRefreshConfig(containerState);

    render(
      <Provider store={this._store}>
        <I18nContext>
          <GisMap/>
        </I18nContext>
      </Provider>,
      domNode
    );
  }

  destroy() {
    this._savedMap.destroy();
    if (this._domNode) {
      unmountComponentAtNode(this._domNode);
    }
  }

  reload() {
    this._dispatchSetQuery({
      query: this._prevQuery,
      timeRange: this._prevTimeRange,
      filters: this._prevFilters
    });
  }
}
