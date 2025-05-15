import { getMeetings, addMeeting, deleteMeeting, Meeting } from '../services/storage';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert, Share, Platform, Button, StyleSheet, Text } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { exportMeetings, importMeetings } from '../services/storage';

export default function MeetingListScreen() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      const storedMeetings = await getMeetings();
      setMeetings(storedMeetings);
    } catch (error) {
      console.error('Error loading meetings:', error);
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMeeting = async (meeting: Meeting) => {
    try {
      await addMeeting(meeting);
      await loadMeetings(); // Reload the meetings list
    } catch (error) {
      console.error('Error adding meeting:', error);
      Alert.alert('Error', 'Failed to add meeting');
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      await deleteMeeting(meetingId);
      await loadMeetings(); // Reload the meetings list
    } catch (error) {
      console.error('Error deleting meeting:', error);
      Alert.alert('Error', 'Failed to delete meeting');
    }
  };

  const handleExport = async () => {
    try {
      const jsonString = await exportMeetings();
      
      if (Platform.OS === 'web') {
        // For web, create a download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'meetings.json';
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // For mobile, use Share API
        const fileUri = `${FileSystem.documentDirectory}meetings.json`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString);
        await Share.share({
          url: fileUri,
          title: 'Meetings Export',
        });
      }
    } catch (error) {
      console.error('Error exporting meetings:', error);
      Alert.alert('Error', 'Failed to export meetings');
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
      });

      if (result.type === 'success') {
        const fileContent = await FileSystem.readAsStringAsync(result.uri);
        await importMeetings(fileContent);
        await loadMeetings(); // Reload the meetings list
        Alert.alert('Success', 'Meetings imported successfully');
      }
    } catch (error) {
      console.error('Error importing meetings:', error);
      Alert.alert('Error', 'Failed to import meetings');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button title="Export Meetings" onPress={handleExport} />
        <Button title="Import Meetings" onPress={handleImport} />
      </View>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <View>
          {meetings.map(meeting => (
            <View key={meeting.id}>
              <Text>{meeting.title}</Text>
              <Text>{meeting.date}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
}); 