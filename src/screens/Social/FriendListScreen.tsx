﻿import {Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import SearchWindow from '@components/Social/SearchWindow';
import {
  SearchWindowRef,
  UserIdToNicknameMapping,
} from '@src/types/various/Search';
import GeneralAction from '@src/types/various/GeneralAction';
import React, {useMemo, useReducer, useRef} from 'react';
import {objKeys} from '@libs/DataHandling';
import {getNicknameMapping} from '@libs/SearchUtils';
import {searchArrayByText} from '@libs/Search';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {UserArray} from '@src/types/database';
import UserListComponent from '@components/Social/UserListComponent';
import useProfileList from '@hooks/useProfileList';
import {useFocusEffect} from '@react-navigation/native';
import NoFriendInfo from '@components/Social/NoFriendInfo';

interface State {
  searching: boolean;
  friends: UserArray;
  friendsToDisplay: UserArray;
}

const initialState: State = {
  searching: false,
  friends: [],
  friendsToDisplay: [],
};

const reducer = (state: State, action: GeneralAction): State => {
  switch (action.type) {
    case 'SET_SEARCHING':
      return {...state, searching: action.payload};
    case 'SET_FRIENDS':
      return {...state, friends: action.payload};
    case 'SET_FRIENDS_TO_DISPLAY':
      return {...state, friendsToDisplay: action.payload};
    default:
      return state;
  }
};

type FriendListScreenProps = {};

const FriendListScreen = (props: FriendListScreenProps) => {
  const {userData, refetch} = useDatabaseData();
  const friendListInputRef = useRef<SearchWindowRef>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const {profileList} = useProfileList(state.friends);

  const localSearch = async (searchText: string) => {
    try {
      dispatch({type: 'SET_SEARCHING', payload: true});
      let searchMapping: UserIdToNicknameMapping = getNicknameMapping(
        profileList,
        'display_name',
      );
      let relevantResults = searchArrayByText(
        state.friends,
        searchText,
        searchMapping,
      );
      dispatch({type: 'SET_FRIENDS_TO_DISPLAY', payload: relevantResults}); // Hide irrelevant
    } catch (error: any) {
      Alert.alert(
        'Database serach failed',
        'Could not search the database: ' + error.message,
      );
      return;
    } finally {
      dispatch({type: 'SET_SEARCHING', payload: false});
    }
  };

  const resetSearch = () => {
    dispatch({type: 'SET_FRIENDS_TO_DISPLAY', payload: state.friends});
  };

  useMemo(() => {
    let friendsArray = objKeys(userData?.friends);
    dispatch({type: 'SET_FRIENDS', payload: friendsArray});
    dispatch({type: 'SET_FRIENDS_TO_DISPLAY', payload: friendsArray});
  }, [userData]);

  useFocusEffect(
    React.useCallback(() => {
      try {
        refetch(['userData']);
      } catch (error: any) {
        Alert.alert(
          'Failed to contact the database',
          'Could not update user data:' + error.message,
        );
      }
    }, []),
  );

  return (
    <View style={styles.mainContainer}>
      <SearchWindow
        ref={friendListInputRef}
        windowText="Search your friend list"
        onSearch={localSearch}
        onResetSearch={resetSearch}
        searchOnTextChange={true}
      />
      <UserListComponent
        fullUserArray={state.friends}
        initialLoadSize={15}
        emptyListComponent={<NoFriendInfo />}
        userSubset={state.friendsToDisplay}
        orderUsers={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffff99',
  },
});

export default FriendListScreen;
