"""Check that every scenario road uses its documented historical calibration."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check():
    scenario = json.loads((ROOT / 'data/scenario_mvp.json').read_text())
    catalog = json.loads((ROOT / 'data/route_calibration.json').read_text())
    model = catalog['model']
    records = {(r['a'], r['b']): r for r in catalog['routes']}
    assert len(records) == len(catalog['routes']), 'Duplicate calibration records'
    assert len(scenario['routes']) == len(records), 'Missing or obsolete route records'
    edges = set()
    for road in scenario['routes']:
        key = (road['a'], road['b'])
        edge = tuple(sorted(key))
        assert edge not in edges, f'Duplicate road {key}'
        edges.add(edge)
        record = records[key]
        assert record['sources'] and record['note'], f'Undocumented road {key}'
        assert road['calibration_method'] == record['method']
        assert road['distance_km'] == record['distance_km'] > 0
        assert road['terrain'] == record['terrain']
        expected = round(road['distance_km'] / model['foot_km_per_day'][road['terrain']], 2)
        assert road['days'] == record['foot_days'] == expected, f'Incorrect travel time {key}'
        assert road['mounted_speed_cap'] == model['mounted_speed_cap'][road['terrain']]
        if record['method'] == 'recorded_li':
            assert abs(record['distance_km'] - record['recorded_li'] * model['han_li_km']) < .01
    assert scenario['route_calibration_version'] == catalog['version']
    balance = json.loads((ROOT / 'data/balance.json').read_text())
    assert balance['movement']['convoy_speed_mult'] == model['convoy_speed_mult']
    print(f'All {len(records)} roads match their distance evidence and movement model.')


if __name__ == '__main__':
    check()
