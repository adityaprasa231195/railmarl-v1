import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import OverviewDashboard from './pages/OverviewDashboard'
import PlatformManagement from './pages/PlatformManagement'
import TrainManagement from './pages/TrainManagement'
import SmartAllocation from './pages/SmartAllocation'
import MLInsights from './pages/MLInsights'
import TrafficManagement from './pages/TrafficManagement'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewDashboard />} />
        <Route path="/traffic" element={<TrafficManagement />} />
        <Route path="/platforms" element={<PlatformManagement />} />
        <Route path="/trains" element={<TrainManagement />} />
        <Route path="/allocation" element={<SmartAllocation />} />
        <Route path="/insights" element={<MLInsights />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
