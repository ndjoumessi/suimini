import { Tabs } from 'expo-router';
import { House, TreePine, Users, Clock, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TabBar } from '@/components/layout/TabBar';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color }) => <House size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tree"
        options={{
          title: t('nav.tree'),
          tabBarIcon: ({ color }) => <TreePine size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: t('nav.people'),
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: t('nav.timeline'),
          tabBarIcon: ({ color }) => <Clock size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarIcon: ({ color }) => <Settings size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
