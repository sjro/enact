/**
 * Provides components and methods to add support for handling cancel actions.
 *
 * @module ui/Cancelable
 * @exports addCancelHandler
 * @exports Cancelable
 * @exports removeCancelHandle
 */

import {forward, handle, stop, stopImmediate} from '@enact/core/handle';
import hoc from '@enact/core/hoc';
import {add} from '@enact/core/keymap';
import useClass from '@enact/core/useClass';
import invariant from 'invariant';
import PropTypes from 'prop-types';
import React from 'react';

import {forCancel, addCancelHandler, removeCancelHandler} from './cancelHandler';
import {addModal, removeModal} from './modalHandler';

class Cancel {
	constructor (props) {
		this.props = props;
		this.context = {}; // Needed to get the ture value as the return value of the `hasPropsAndContext`.
	}

	handleCancel = handle(
		forCancel,
		forward('onCancel'),
		(ev) => (this.props.dispatchCancelToConfig(ev, this.props)),
		stop,
		stopImmediate
	)

	handleKeyUp = handle(
		forward('onKeyUp'),
		// nesting handlers for DRYness. note that if any conditions return false in
		// this.handleCancel(), this handler chain will stop too
		this.handleCancel
	).bind(this)
}

function mountEffect (state, modal) {
	// layout effect order doesn't appear to be consistent with request order so we must invoked
	// addModal synchronously with render. addModal guards against dupliate entries so calling
	// on effect creation is safe but we still need a cleanup fn in order to remove the modal on
	// unmount (which is guaranteed to be only once with the empty memo array below).
	if (modal) addModal(state);

	return () => () => {
		if (modal) removeModal(state);
	};
}

/**
 * Configuration for `useCancel`
 *
 * @typedef {Object} useCancelConfig
 * @memberof ui/Cancelable
 * @property {Function} [dispatchCancelToConfig]  The handler making the `onCancel event bubbling up or not
 * @property {Boolean}  [modal = false]           The flag to cancel events globally
 * @private
 */

/**
 * Manages a cancel action.
 *
 * The cancel action is handled via the configured `onCancel` handler.
 *
 * @param {useCancelConfig} config Configuration options
 * @returns {useCancelInterface}
 * @private
 */
function useCancel ({modal, ...config} = {}) {
	const cancel = useClass(Cancel, config);

	React.useLayoutEffect(mountEffect(cancel, modal), [cancel]);

	return {
		handleKeyUp: cancel.handleKeyUp
	};
}

/**
 * Default config for {@link ui/Cancelable.Cancelable}
 *
 * @memberof ui/Cancelable.Cancelable
 * @hocconfig
 */
const defaultConfig = {
	/**
	 * Called when a cancel action is invoked by the user.
	 *
	 * If it is a string, the cancel handler will attempt to invoke a function passed as a prop of
	 * that name. If it is a function, that function will be called with the current props as the
	 * only argument.
	 *
	 * If the function handles the cancel action, it should call `stopPropagation()` on the provided
	 * event object prevent container or `modal` Cancelable instances from also handling the action.
	 *
	 * @type {String|Function}
	 * @required
	 * @memberof ui/Cancelable.Cancelable.defaultConfig
	 */
	onCancel: null,

	/**
	 * Subscribes to cancel events globally for this instance.
	 *
	 * When `true`, the `Cancelable` instance will handle cancel events globally that successfully
	 * bubble up to `window` regardless of which component is focused.
	 *
	 * `modal` cancel handlers are processed in reverse of the order they are created such that the
	 * innermost instance (in terms of the component hierarchy) have the first opportunity to handle
	 * the event before its container components.
	 *
	 * @type {String}
	 * @default false
	 * @memberof ui/Cancelable.Cancelable.defaultConfig
	 */
	modal: false,

	/**
	 * The component that will contain the wrapped component.
	 *
	 * When set, the wrapped component will be contained within an instance of `component`. This may
	 * be necessary if the props passed to the wrapped component are not placed on the root element.
	 *
	 * @type {Component}
	 * @default null
	 * @memberof ui/Cancelable.Cancelable.defaultConfig
	 */
	component: null
};

// Add keymap for escape key
add('cancel', 27);

/**
 * A higher-order component that adds support to a component to handle cancel actions.
 *
 * The cancel event may be handled either by a design-time config function or a run-time prop
 * function. If the component handles the event and wants to prevent upstream components from also
 * handling the event, the callback should invoke `stopPropagation()` on the event object.
 *
 * Note: This HoC passes a number of props to the wrapped component that should be passed to the
 * main DOM node.
 *
 * Usage of config function:
 * ```
 * import Cancelable from '@enact/ui/Cancelable';
 *
 * const MyComponent = ({myProp, ...rest}) => (
 *    <div {...rest}>{myProp}</div>
 *  );
 * ...
 * const CancelableComponent = Cancelable(
 *   {cancel: function (ev, props) {
 *     // Can inspect either the `onCancel` event, `ev`, and/or the `props` to determine how
 *     // to handle the event (e.g. invoking an event handler from `props`).
 *
 *     // Stop upstream instances of Cancelable from handling the event
 *     ev.stopPropagaion();
 *   }},
 *   MyComponent
 * );
 * ```
 *
 * Usage of prop function:
 * ```
 * import Cancelable from '@enact/ui/Cancelable';
 *
 * const CancelableComponent = Cancelable(
 *   // When a cancel action is received and a handler function exists for the prop
 *   // `onCancel`, it will be invoked and passed the `onCancel` event object.
 *   {cancel: 'onCancel'},
 *   MyComponent
 * );
 * ```
 *
 * @class Cancelable
 * @memberof ui/Cancelable
 * @hoc
 * @public
 */
const CancelableHOC = hoc(defaultConfig, (config, Wrapped) => {
	const {
		onCancel,
		modal,
		component: Component
	} = config;

	invariant(onCancel, 'onCancel must be specified with Cancelable');

	const onCancelIsString = typeof onCancel === 'string';
	const onCancelIsFunction = typeof onCancel === 'function';
	const dispatchCancelToConfig = function (ev, props) {
		// by default, we return false which allows event propagation because it will "break" the
		// handler chain and not call `stop` and `stopImmediate` below
		let stopped = false;

		const cancelEvent = {
			type: 'onCancel',
			stopPropagation: () => {
				stopped = true;
			}
		};

		if (onCancelIsString && typeof props[onCancel] === 'function') {
			// use the custom event name from the config
			cancelEvent.type = onCancel;
			props[onCancel](cancelEvent);
		} else if (onCancelIsFunction) {
			onCancel(cancelEvent, props);
		}

		return stopped;
	};

	function renderModal (props) {
		return (
			<Wrapped {...props} />
		);
	}

	function renderWrapped (props, handleKeyUp) {
		return (
			<Component onKeyUp={handleKeyUp}>
				<Wrapped {...props} />
			</Component>
		);
	}

	function renderUnwrapped (props, handleKeyUp) {
		return (
			<Wrapped {...props} onKeyUp={handleKeyUp} />
		);
	}

	function Cancelable (props) {
		const updated = {...props};

		const {handleKeyUp} = useCancel({
			dispatchCancelToConfig,
			modal,
			...props
		});

		delete updated.onCancel;
		delete updated[onCancel];

		return	modal && renderModal(updated) ||
				Component && renderWrapped(updated, handleKeyUp) ||
				renderUnwrapped(updated, handleKeyUp);
	}

	Cancelable.displayName = 'Cancelable';

	Cancelable.propTypes = /** @lends ui/Cancelable.Cancelable.prototype */ {
		/**
		 * Called when a cancel action is received.
		 *
		 * This callback is invoked for every cancel action before the config or prop handler is
		 * invoked.
		 *
		 * @type {Function}
		 * @public
		 */
		onCancel: PropTypes.func
	};

	return Cancelable;
});

export default CancelableHOC;
export {
	addCancelHandler,
	CancelableHOC as Cancelable,
	removeCancelHandler
};
