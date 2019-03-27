/**
 * Provides Moonstone styled item components and behaviors. Useful for content in lists.
 *
 * @example
 * <Item>Hello Enact!</Item>
 *
 * @module moonstone/Item
 * @exports Item
 * @exports ItemBase
 * @exports ItemDecorator
 */

import {forward} from '@enact/core/handle';
import kind from '@enact/core/kind';
import {Job} from '@enact/core/util';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import {ItemBase as UiItemBase, ItemDecorator as UiItemDecorator} from '@enact/ui/Item';
import Pure from '@enact/ui/internal/Pure';
import PropTypes from 'prop-types';
import compose from 'ramda/src/compose';
import React from 'react';
import ReactDOM from 'react-dom';

import {MarqueeDecorator} from '../Marquee';
import Skinnable from '../Skinnable';

import componentCss from './Item.module.less';

/**
 * A Moonstone styled item without any behavior.
 *
 * @class ItemBase
 * @memberof moonstone/Item
 * @extends ui/Item.ItemBase
 * @ui
 * @public
 */
const ItemBase = kind({
	name: 'Item',

	propTypes: /** @lends moonstone/Item.ItemBase.prototype */ {
		/**
		 * Customizes the component by mapping the supplied collection of CSS class names to the
		 * corresponding internal Elements and states of this component.
		 *
		 * The following classes are supported:
		 *
		 * * `item` - The root class name
		 *
		 * @type {Object}
		 * @public
		 */
		css: PropTypes.object
	},

	styles: {
		css: componentCss,
		publicClassNames: 'item'
	},

	render: ({css, ...rest}) => {
		return UiItemBase.inline({
			'data-webos-voice-intent': 'Select',
			...rest,
			css
		});
	}
});

/**
 * Moonstone specific item behaviors to apply to [Item]{@link moonstone/Item.ItemBase}.
 *
 * @class ItemDecorator
 * @hoc
 * @memberof moonstone/Item
 * @mixes spotlight.Spottable
 * @mixes moonstone/Marquee.MarqueeDecorator
 * @mixes moonstone/Skinnable
 * @ui
 * @public
 */
const ItemDecorator = compose(
	UiItemDecorator,
	Spottable,
	MarqueeDecorator({invalidateProps: ['inline', 'autoHide']}),
	Skinnable
);

const ItemFull = ItemDecorator(ItemBase);

const ItemLightDecorator = compose(
	Spottable,
	Skinnable
);

const ItemLight = ItemLightDecorator(ItemBase);

/**
 * A Moonstone styled item with built-in support for marqueed text, and Spotlight focus.
 *
 * Usage:
 * ```
 * <Item>Item Content</Item>
 * ```
 *
 * @class Item
 * @memberof moonstone/Item
 * @extends moonstone/Item.ItemBase
 * @mixes moonstone/Item.ItemDecorator
 * @ui
 * @public
 */
class Item extends React.PureComponent {
	static displayName = 'ItemSpotlightDecorator'

	static propTypes =  /** @lends moonstone/Item.ItemSpotlightDecorator.prototype */ {
		/**
		 * Applies a disabled state to the item.
		 *
		 * @type {Boolean}
		 * @default false
		 * @public
		 */
		disabled: PropTypes.bool
	}

	static defaultProps = {
		disabled: false
	}

	constructor (props) {
		super(props);

		this.state = {
			lightweight: true
		};
		this.shouldPreventFocus = false;
	}

	componentDidUpdate (prevProps, prevState) {
		if (prevState.lightweight && !this.state.lightweight && !Spotlight.getCurrent()) {
			// eslint-disable-next-line react/no-find-dom-node
			ReactDOM.findDOMNode(this).focus();
		}
	}

	componentWillUnmount () {
		this.renderJob.stop();
	}

	handleBlur = (ev) => {
		forward('onBlur', ev, this.props);
		this.shouldPreventFocus = false;
		this.renderJob.stop();
	}

	handleFocus = (ev) => {
		if (this.shouldPreventFocus) {
			ev.preventDefault();
			ev.stopPropagation();
			this.shouldPreventFocus = false;
			return;
		}

		if (this.state.lightweight) {
			this.shouldPreventFocus = true;
			this.startRenderJob();
		} else {
			forward('onFocus', ev, this.props);
		}
	}

	handleMouseEnter = (ev) => {
		if (this.state.lightweight) {
			this.startRenderJob();
		} else {
			forward('onMouseEnter', ev, this.props);
		}
	}

	handleMouseLeave = (ev) => {
		forward('onMouseLeave', ev, this.props);
		this.renderJob.stop();
	}

	startRenderJob = () => {
		// 100 is a somewhat arbitrary value to avoid rendering when 5way hold events are moving focus through the item.
		// The timing appears safe against default spotlight accelerator speeds.
		this.renderJob.startAfter(100);
	}

	renderJob = new Job(() => {
		this.setState({
			lightweight: false
		});
	})

	render () {
		const Component = this.state.lightweight ? ItemLight : ItemFull;

		return (
			<Component
				{...this.props}
				onBlur={this.handleBlur}
				onFocus={this.handleFocus}
				onMouseEnter={this.handleMouseEnter}
				onMouseLeave={this.handleMouseLeave}
			/>
		);
	}
}

export default Item;
export {
	Item,
	ItemBase,
	ItemDecorator
};
