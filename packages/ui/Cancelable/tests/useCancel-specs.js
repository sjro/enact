import {mount} from 'enzyme';
import React from 'react';

import {addCancelHandler, removeCancelHandler, useCancel} from '../useCancel';

describe('useCancel', () => {

	// eslint-disable-next-line enact/prop-types
	function Component ({children, className, modal, onCancel, onCancelWithStopPropagation, onKeyUp}) {
		const {keyUp} = useCancel({
			modal,
			onCancel,
			onCancelWithStopPropagation
		});

		function handleKeyUp (ev) {
			if (onKeyUp) {
				onKeyUp(ev);
			}
			if (keyUp) {
				keyUp(ev);
			}
		}

		return (
			<div className={className} onKeyUp={handleKeyUp}>
				{children}
			</div>
		);
	}

	const makeKeyEvent = (keyCode) => {
		return {
			keyCode,
			nativeEvent: {
				stopImmediatePropagation: jest.fn()
			}
		};
	};

	/* eslint-disable react/jsx-no-bind */
	const returnsTrue = () => true;
	const stop = (ev) => ev.stopPropagation();

	test('should call onCancelWithStopPropagation for escape key by default', () => {
		const handleCancel = jest.fn(returnsTrue);
		const subject = mount(
			<Component onCancelWithStopPropagation={handleCancel} />
		);

		subject.simulate('keyup', makeKeyEvent(27));

		const expected = 1;
		const actual = handleCancel.mock.calls.length;

		expect(actual).toBe(expected);
	});

	test('should not call onCancelWithStopPropagation for non-escape key', () => {
		const handleCancel = jest.fn(returnsTrue);
		const subject = mount(
			<Component onCancelWithStopPropagation={handleCancel} />
		);

		subject.simulate('keyup', makeKeyEvent(42));

		const expected = 0;
		const actual = handleCancel.mock.calls.length;

		expect(actual).toBe(expected);
	});

	test('should stop propagation when handled', () => {
		const handleCancel = jest.fn(stop);
		const keyEvent = makeKeyEvent(27);
		const subject = mount(
			<Component onCancelWithStopPropagation={handleCancel} />
		);

		subject.simulate('keyup', keyEvent);

		const expected = 1;
		const actual = keyEvent.nativeEvent.stopImmediatePropagation.mock.calls.length;

		expect(actual).toBe(expected);
	});

	test('should not stop propagation for not handled', () => {
		const handleCancel = jest.fn(returnsTrue);
		const keyEvent = makeKeyEvent(42);
		const subject = mount(
			<Component onCancelWithStopPropagation={handleCancel} />
		);

		subject.simulate('keyup', keyEvent);

		const expected = 0;
		const actual = keyEvent.nativeEvent.stopImmediatePropagation.mock.calls.length;

		expect(actual).toBe(expected);
	});

	test('should forward to onKeyUp handler for any key', () => {
		const handleKeyUp = jest.fn();
		const keyEvent = makeKeyEvent(42);
		const subject = mount(
			<Component onCancelWithStopPropagation={returnsTrue} onKeyUp={handleKeyUp} />
		);

		subject.simulate('keyup', keyEvent);

		const expected = 1;
		const actual = handleKeyUp.mock.calls.length;

		expect(actual).toBe(expected);
	});

	test('should call onCancelWithStopPropagation when additional cancel handlers pass', () => {
		const customCancelHandler = (ev) => ev.keyCode === 461;
		addCancelHandler(customCancelHandler);
		const handleCancel = jest.fn(returnsTrue);
		const subject = mount(
			<Component onCancelWithStopPropagation={handleCancel} />
		);

		subject.simulate('keyup', makeKeyEvent(461));

		removeCancelHandler(customCancelHandler);

		const expected = 1;
		const actual = handleCancel.mock.calls.length;

		expect(actual).toBe(expected);
	});

	test(
		'should bubble up the component tree when config handler does not call stopPropagation',
		() => {
			const handleCancel = jest.fn(returnsTrue);
			const subject = mount(
				<Component onCancelWithStopPropagation={handleCancel}>
					<Component className="second" onCancelWithStopPropagation={handleCancel} />
				</Component>
			);

			subject.find('Component.second').simulate('keyup', makeKeyEvent(27));

			const expected = 2;
			const actual = handleCancel.mock.calls.length;

			expect(actual).toBe(expected);
		}
	);

	test(
		'should not bubble up the component tree when config handler calls stopPropagation',
		() => {
			const handleCancel = jest.fn(stop);
			const subject = mount(
				<Component onCancelWithStopPropagation={handleCancel}>
					<Component className="second" onCancelWithStopPropagation={handleCancel} />
				</Component>
			);

			subject.find('Component.second').simulate('keyup', makeKeyEvent(27));

			const expected = 1;
			const actual = handleCancel.mock.calls.length;

			expect(actual).toBe(expected);
		}
	);

	describe('modal instances', () => {
		const customEventHandler = (ev) => {
			return ev.keyIdentifier === '27';
		};

		const makeKeyboardEvent = (keyCode) => {
			return new window.KeyboardEvent('keyup', {keyCode, code: keyCode, bubbles: true});
		};

		beforeAll(() => {
			addCancelHandler(customEventHandler);
		});

		afterAll(() => {
			removeCancelHandler(customEventHandler);
		});

		test(
			'should invoke handler for cancel events dispatch to the window',
			() => {
				const handleCancel = jest.fn(returnsTrue);
				mount(<Component modal onCancelWithStopPropagation={handleCancel} />);
				document.dispatchEvent(makeKeyboardEvent(27));

				const expected = 1;
				const actual = handleCancel.mock.calls.length;

				expect(actual).toBe(expected);
			}
		);

		test('should invoke modal handlers in LIFO order', () => {
			const results = [];
			const append = str => () => {
				results.push(str);
				return false;
			};

			mount(<Component modal onCancelWithStopPropagation={append('first')} />);
			mount(<Component modal onCancelWithStopPropagation={append('second')} />);

			document.dispatchEvent(makeKeyboardEvent(27));

			const expected = ['second', 'first'];
			const actual = results;

			expect(actual).toEqual(expected);
		});

		test('should invoke nested modal handlers in LIFO order', () => {
			const results = [];
			const append = str => () => {
				results.push(str);
				return false;
			};

			mount(
				<Component modal onCancelWithStopPropagation={append('first')}>
					<Component modal onCancelWithStopPropagation={append('second')} />
				</Component>
			);

			document.dispatchEvent(makeKeyboardEvent(27));

			const expected = ['second', 'first'];
			const actual = results;

			expect(actual).toEqual(expected);
		});

		test(
			'should not invoke modal handlers after one calls stopPropagation',
			() => {
				const handleCancel = jest.fn(returnsTrue);

				mount(<Component modal onCancelWithStopPropagation={handleCancel} />);
				mount(<Component modal onCancelWithStopPropagation={stop} />);

				document.dispatchEvent(makeKeyboardEvent(27));

				const expected = 0;
				const actual = handleCancel.mock.calls.length;

				expect(actual).toBe(expected);
			}
		);
	});
});