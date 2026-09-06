// Rack info HUD: displays rack name and device inventory when a rack is selected
import React from 'react';
import { INK } from '../liquid/charts';
import { RACK_BY_ID, RACK_DEVICES, type RackDevice } from './issues';

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export interface RackInfoHUDProps {
  selectedRackId: string | null;
}

const DEVICE_TYPE_COLOR: Record<string, string> = {
  storage: '#ffa500',
  compute: '#00bfff',
  network: '#00ff00',
  power: '#ffff00',
  blank: '#888888',
};

const DEVICE_TYPE_LABEL: Record<string, string> = {
  storage: 'Storage',
  compute: 'Compute',
  network: 'Network',
  power: 'Power',
  blank: 'Blank',
};

export function RackInfoHUD({ selectedRackId }: RackInfoHUDProps) {
  if (!selectedRackId) return null;

  const rackInfo = RACK_BY_ID[selectedRackId];
  if (!rackInfo) return null;

  const panel: React.CSSProperties = {
    position: 'absolute',
    top: 64,
    left: 20,
    maxHeight: 'calc(100vh - 120px)',
    width: 320,
    display: 'flex',
    flexDirection: 'column',
    background: INK.surface,
    border: `1px solid ${INK.border}`,
    borderRadius: 10,
    backdropFilter: 'blur(10px)',
    color: INK.primary,
    fontFamily: FONT,
    fontSize: 11,
    overflow: 'hidden',
    zIndex: 25,
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderBottom: `1px solid ${INK.border}`,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#8cc7ff',
    background: 'rgba(140,199,255,0.08)',
  };

  const listStyle: React.CSSProperties = {
    listStyle: 'none',
    margin: 0,
    padding: '8px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    scrollbarWidth: 'thin',
    flex: 1,
  };

  const deviceItemStyle = (_device: RackDevice): React.CSSProperties => ({
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    padding: '6px 8px',
    borderRadius: 6,
    background: INK.card,
    border: `1px solid ${INK.border}`,
    fontSize: 10,
  });

  const uLabelStyle: React.CSSProperties = {
    flex: '0 0 40px',
    fontWeight: 600,
    color: '#ffc0cb',
    textAlign: 'right',
    paddingRight: 4,
  };

  const deviceNameStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };

  const nameStyle: React.CSSProperties = {
    fontWeight: 600,
    color: INK.primary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const typeStyle = (type: string): React.CSSProperties => ({
    fontSize: 9,
    color: DEVICE_TYPE_COLOR[type] || INK.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  });

  const heightStyle: React.CSSProperties = {
    flex: '0 0 24px',
    fontSize: 9,
    color: INK.muted,
    textAlign: 'center',
    paddingLeft: 4,
  };

  return (
    <div style={panel}>
      <div style={headerStyle}>
        {rackInfo.label}
        <div style={{ fontSize: 10, fontWeight: 400, color: INK.muted, marginTop: 2 }}>42U rack · {RACK_DEVICES.length} devices</div>
      </div>
      <ul style={listStyle}>
        {RACK_DEVICES.map((device) => (
          <li key={`${device.u}-${device.name}`} style={deviceItemStyle(device)}>
            <div style={uLabelStyle}>U{device.u}</div>
            <div style={deviceNameStyle}>
              <span style={nameStyle}>{device.name}</span>
              <span style={typeStyle(device.type)}>{DEVICE_TYPE_LABEL[device.type]}</span>
            </div>
            <div style={heightStyle}>{device.height}U</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
