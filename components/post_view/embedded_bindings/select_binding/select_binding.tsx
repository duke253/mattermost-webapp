// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ActionResult} from 'mattermost-redux/types/actions';

import {Post} from 'mattermost-redux/types/posts';

import {AppBinding, AppCall, AppCallResponse} from 'mattermost-redux/types/apps';

import {AppBindingLocations, AppCallResponseTypes, AppExpandLevels} from 'mattermost-redux/constants/apps';

import {injectIntl, IntlShape} from 'react-intl';

import MenuActionProvider from 'components/suggestion/menu_action_provider';
import AutocompleteSelector from 'components/autocomplete_selector';
import PostContext from 'components/post_view/post_context';
import {createCallRequest} from 'utils/apps';
import {sendEphemeralPost} from 'actions/global_actions';

type Option = {
    text: string;
    value: string;
};

type Props = {
    intl: IntlShape;
    post: Post;
    binding: AppBinding;
    userId: string;
    actions: {
        doAppCall: (call: AppCall) => Promise<ActionResult>;
    };
};

type State = {
    selected?: Option;
};

class SelectBinding extends React.PureComponent<Props, State> {
    private providers: MenuActionProvider[];

    constructor(props: Props) {
        super(props);

        const binding = props.binding;
        this.providers = [];
        if (binding.bindings) {
            const options = binding.bindings.map((b) => {
                return {text: b.label, value: b.location};
            });
            this.providers = [new MenuActionProvider(options)];
        }

        this.state = {};
    }

    handleSelected = async (selected: Option) => {
        if (!selected) {
            return;
        }

        this.setState({selected});
        const binding = this.props.binding.bindings?.find((b) => b.location === selected.value);
        if (!binding) {
            console.debug('Trying to select element not present in binding.'); //eslint-disable-line no-console
            return;
        }

        if (!binding.call) {
            return;
        }

        const {userId, post} = this.props;

        const call = createCallRequest(
            binding.call,
            userId,
            binding.app_id,
            AppBindingLocations.IN_POST + '/' + binding.location,
            {post: AppExpandLevels.EXPAND_ALL},
            post.channel_id,
            post.id,
        );

        const res = await this.props.actions.doAppCall(call);
        const callResp = (res as {data: AppCallResponse}).data;
        const ephemeral = (message: string) => sendEphemeralPost(message, this.props.post.channel_id, this.props.post.root_id);
        switch (callResp.type) {
        case AppCallResponseTypes.OK:
            if (callResp.markdown) {
                ephemeral(callResp.markdown);
            }
            break;
        case AppCallResponseTypes.ERROR: {
            const errorMessage = callResp.error || this.props.intl.formatMessage({id: 'apps.error.unknown', defaultMessage: 'Unknown error happenned'});
            ephemeral(errorMessage);
            break;
        }
        case AppCallResponseTypes.NAVIGATE:
        case AppCallResponseTypes.FORM:
            break;
        default: {
            const errorMessage = this.props.intl.formatMessage(
                {id: 'apps.error.responses.unknown_type', defaultMessage: 'App response type not supported. Response type: {type}.'},
                {type: callResp.type},
            );
            ephemeral(errorMessage);
        }
        }
    }

    render() {
        const {binding} = this.props;

        return (
            <PostContext.Consumer>
                {({handlePopupOpened}) => (
                    <AutocompleteSelector
                        providers={this.providers}
                        onSelected={this.handleSelected}
                        placeholder={binding.label}
                        inputClassName='post-attachment-dropdown'
                        value={this.state.selected?.text}
                        toggleFocus={handlePopupOpened}
                    />
                )}
            </PostContext.Consumer>
        );
    }
}

export default injectIntl(SelectBinding);