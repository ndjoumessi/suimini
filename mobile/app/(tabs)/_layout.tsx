import { Tabs } from 'expo-router';
import { House, TreePine, Users, Clock, Settings } from 'lucide-react-native';
import { TabBar } from '@/components/layout/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <House size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tree"
        options={{
          title: 'Arbre',
          tabBarIcon: ({ color }) => <TreePine size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'Famille',
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'Chrono',
          tabBarIcon: ({ color }) => <Clock size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Réglages',
          tabBarIcon: ({ color }) => <Settings size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
