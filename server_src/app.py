from flask import Flask, jsonify, request
from flask_cors import CORS
import uuid
import time
import base64
from csgo.parser import DemoParser
import os
import shutil
import glob
import json
import pandas as pd
import copy


# configuration
DEBUG = True

# instantiate the app
app = Flask(__name__)
app.config.from_object(__name__)

# enable CORS
CORS(app, resources={r'/*': {'origins': '*'}})



BOARDS = {}
RAW_DEMO = {}
BINDINGS = {}

class Board:
    def __init__(self, title, id, config, graph, data):
        self.title = title
        self.id = id
        self.config = config
        self.graph = graph
        self.data = data

    def fetch_bundle(self,bundle_id):
        print("JLEN")
        print([bn.id for bn in self.graph.bundles])
        return [bn for bn in self.graph.bundles if bn.id == bundle_id][0]

    def fetch_bundle_boxes(self,bundle_id):
        return [box for box in self.graph.boxes if box.bundle_id == bundle_id]

    def fetch_bundle_by_label(self,bundle_label):
        return [bn for bn in self.graph.bundles if bn.label == bundle_label][0]

    def fetch_bundle_boxes_by_label(self,bundle_label):
        bundle = self.fetch_bundle_by_label(bundle_label)
        return self.fetch_bundle_boxes(bundle.id)

    def json(self):
        config_payload = {
            'bundle_default_color': self.config.bundle_default_color,
            'bundle_label_config': self.config.bundle_label_config,
            'bundle_selected_indicator': self.config.bundle_selected_indicator,
            'box_configurable': self.config.box_configurable,
        }

        graph_payload = {
            'bundles':[],
            'boxes':[],
            'links':[],
        }
        bundle_indecies = {}
        for b in self.graph.bundles:
            bundle_payload = {
                'id': b.id,
                'label': b.label,
                'color': b.color,
            }
            graph_payload['bundles'].append(bundle_payload)

        for b in self.graph.boxes:
            box_payload = {
                'id': b.id,
                'bundle_id': b.bundle_id,
                'x1': b.x1,
                'y1': b.y1,
                'x2': b.x2,
                'y2': b.y2,
                'layers': b.layers,
            }
            graph_payload['boxes'].append(box_payload)

        for l in self.graph.links:
            link_payload = {
                'bundle0_id': l.bundle0_id,
                'bundle1_id': l.bundle1_id,
            }
            graph_payload['links'].append(link_payload)

        data_payload = self.data

        payload = {
            "config": config_payload,
            "graph": graph_payload,
            "data": data_payload,
        }

        print(payload)

        return payload



class Config:
    def __init__(self,bundle_default_color,bundle_label_config,bundle_selected_indicator,box_configurable):
        self.bundle_default_color = bundle_default_color
        self.bundle_label_config = bundle_label_config
        self.bundle_selected_indicator = bundle_selected_indicator
        self.box_configurable = box_configurable

class Graph:
    def __init__(self, bundles, boxes, links):
        self.bundles = bundles
        self.boxes = boxes
        self.links = links

    def deepcopy(self):
        new_bundle_list = []
        bundle_id_mappings = {}
        for bundle in self.bundles:
            new_bundle_id = str(uuid.uuid1())
            bundle_id_mappings[bundle.id] = new_bundle_id
            new_bundle = Bundle(new_bundle_id,bundle.label,bundle.color)
            new_bundle_list.append(new_bundle)

        new_box_list = []
        for box in self.boxes:
            new_box_id = str(uuid.uuid1())
            bundle_id = bundle_id_mappings[box.bundle_id]
            new_box = Box(new_box_id, bundle_id, box.x1, box.y1, box.x2, box.y2, box.layers)
            new_box_list.append(new_box)

        new_link_list = []
        for link in self.links:
            bundle0_id = bundle_id_mappings[link.bundle0_id]
            bundle1_id = bundle_id_mappings[link.bundle1_id]
            new_link = Link(bundle0_id,bundle1_id)
            new_link_list.append(new_link)

        return Graph(new_bundle_list, new_box_list, new_link_list)



class Bundle:
    def __init__(self,id,label,color):
        self.id = id
        self.label = label
        self.color = color

class Box:
    def __init__(self,id,bundle_id,x1,y1,x2,y2,layers):
        self.id = id
        self.bundle_id = bundle_id
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        self.layers = layers

class Link:
    def __init__(self, bundle0_id, bundle1_id):
        self.bundle0_id = bundle0_id
        self.bundle1_id = bundle1_id

class Bind:
    def __init__(self, id, action_type, source_board_id, destination_board_id, bundle_entry, bundle_area, dataset_id):
        self.id = id
        self.action_type = action_type
        self.source_board_id = source_board_id
        self.destination_board_id = destination_board_id
        self.bundle_entry = bundle_entry
        self.bundle_area = bundle_area
        self.dataset_id = dataset_id


@app.route('/boards', methods=['GET','POST'])
def all_boards():
    response_object = {'status': 'success'}
    if request.method == 'POST':
        # post_payload = request.get_json()
        # board_id = uuid.uuid4().hex
        #
        # new_board = decipher_payload(board_id,post_payload)
        #
        # BOARDS[board_id] = new_board
        # response_object['new_id'] = board_id
        # response_object['message'] = 'Board added'
        pass
    if request.method == 'GET':
        board_objects = []
        for board_id, board_obj in BOARDS.items():
            bundle_info = [[bundle.id,bundle.label] for bundle in board_obj.graph.bundles]
            response_board = {
                'id': board_id,
                'title': board_obj.title,
                'bundle_info': bundle_info
            }
            board_objects.append(response_board)
        response_object['boards'] = board_objects
    return jsonify(response_object)

@app.route('/boards/<board_id>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def single_board(board_id):
    response_object = {'status': 'success'}
    if request.method == 'GET':
        if board_id in BOARDS:
            response_object['message'] = 'Board found!'
            response_object['board'] = BOARDS[board_id].json()
        else:
            response_object['message'] = 'Board not found'
    if request.method == 'PUT' or request.method == 'POST':
        put_payload = request.get_json()
        new_board = decipher_payload(board_id,put_payload)

        BOARDS[board_id] = new_board
        response_object['message'] = 'Board manipulation'

    if request.method == 'DELETE':
        pass

    # if request.method == 'POST':
    #     put_payload = request.get_json()
    #     new_board = decipher_payload(board_id,put_payload)

    return jsonify(response_object)


@app.route('/boards/bind', methods=['POST'])
def bind():
    response_object = {'status': 'success'}
    if request.method == 'POST':
        post_payload = request.get_json()
        action_id = post_payload["action_id"]
        action_type = post_payload["action_type"]
        source_board_id = post_payload["source_board_id"]
        destination_board_id = post_payload["destination_board_id"]
        bundle_entry = post_payload["bundle_entry"]
        bundle_area = post_payload["bundle_area"]
        dataset_id = post_payload["dataset_id"]

        new_bind = Bind(action_id, action_type, source_board_id, destination_board_id, bundle_entry, bundle_area, dataset_id)

        BINDINGS[post_payload["action_id"]] = new_bind

        print("JBind")
        if action_type == "heatmap":
            generate_heatmap(source_board_id, bundle_entry, bundle_area, dataset_id, destination_board_id)
        elif action_type == "rankings":
            generate_ranking_map(source_board_id, bundle_entry, dataset_id, destination_board_id)


    return jsonify(response_object)


@app.route('/boards/bind/<action_id>/refresh', methods=['POST'])
def refreshBind(action_id):
    response_object = {'status': 'success'}
    if request.method == "POST":
        bind = BINDINGS[action_id]
        if bind.action_type == "heatmap":
            generate_heatmap(bind.source_board_id, bind.bundle_entry, bind.bundle_area, bind.dataset_id, bind.destination_board_id)
        if bind.action_type == "rankings":
            generate_ranking_map(bind.source_board_id, bind.bundle_entry, bind.dataset_id, bind.destination_board_id)
    return jsonify(response_object)


@app.route('/demosets',methods=['GET','DELETE'])
def demosets():
    response_object = {'status': 'success'}
    if request.method == 'GET':
        demosets = glob.glob('parsed_demos_*')
        return_object = []
        for ds in demosets:
            demoset_title = None
            with open(ds + "/metadata.json") as json_file:
                demoset_title = json.load(json_file)['title']

            ds_obj = {
                'value': ds.replace("parsed_demos_",""),
                'text': demoset_title
                }
            return_object.append(ds_obj)

        print(return_object)
        response_object['demosets'] = return_object

    if request.method == 'DELETE':
        return jsonify(response_object)
        demosets = glob.glob('parsed_demos_*')
        for ds in demosets:
            shutil.rmtree(ds)
        response_object['deletion_complete'] = 'success'

    return jsonify(response_object)



@app.route('/demos/<demoset_id>/prep', methods=['POST'])
def prep_demo(demoset_id):
    response_object = {'status': 'success'}
    post_payload = request.get_json()
    # print(post_payload['chunk_count'])
    chunk_count = post_payload['chunk_count']
    chunks = []
    for i in range(chunk_count):
        chunks.append("")
    if demoset_id not in RAW_DEMO:
        RAW_DEMO[demoset_id] = chunks

    return jsonify(response_object)


@app.route('/demos/<demoset_id>', methods=['GET','POST','DELETE'])
def all_demos(demoset_id):
    response_object = {'status': 'success'}

    if request.method == "GET":
        parsed_demos = os.listdir('./parsed_demos_' + demoset_id)
        return_object = []
        for demo in parsed_demos:
            if demo == "metadata.json":
                continue
            return_object.append({'Demo':demo})
        response_object['p_demos'] = return_object

    if request.method == 'POST':
        global RAW_DEMO
        post_payload = request.get_json()
        chunk_index = post_payload['chunk_index']
        while demoset_id not in RAW_DEMO:
            print("SLEEP..." + str(chunk_index))
            time.sleep(5)
        print(chunk_index)
        print(len(post_payload['demo']))
        RAW_DEMO[demoset_id][chunk_index] = post_payload['demo']

        demo_compilication_finished = True
        for demo in RAW_DEMO[demoset_id]:
            if demo == "":
                demo_compilication_finished = False
                break
        if demo_compilication_finished:
            create_demo_data(demoset_id, post_payload['demo_name'])
            RAW_DEMO.pop(demoset_id)
            response_object['complete'] = 1
        else:
            response_object['complete'] = 0

    if request.method == 'DELETE':
        file_path = './parsed_demos_' + demoset_id
        if os.path.exists(file_path):
            shutil.rmtree(file_path)
            response_object['deletion_complete'] = 1



    return jsonify(response_object)

@app.route('/demos/<demoset_id>/set_title', methods=['POST'])
def set_demoset_title(demoset_id):
    response_object = {'status': 'success'}

    if request.method == 'POST':
        dir_path = './parsed_demos_' + demoset_id
        request_payload = request.get_json()
        new_title = request_payload['new_title']
        if os.path.exists(dir_path):

            metadata = None
            with open(dir_path + "/metadata.json") as json_file:
                metadata = json.load(json_file)

            metadata['title'] = new_title


            with open(dir_path + "/metadata.json", 'w') as outfile:
                json.dump(metadata, outfile)

        else:
            os.makedirs(dir_path)
            with open(dir_path + "/metadata.json", 'w') as outfile:
                json.dump({'title':new_title}, outfile)
            response_object['status'] = 'Parsed Demo Directory Not Found'

    return jsonify(response_object)

@app.route('/generate_heatmap/<board_id>', methods=['POST'])
def generate_heatmap_call(board_id):
    print("GENERATE")
    response_object = {'status': 'success'}
    if request.method == 'POST':
        request_payload = request.get_json()
        bundle_entry_id = request_payload['bundle_entry']
        bundle_area_id = request_payload['bundle_area']
        dataset_id = request_payload['dataset_id']
        response_object['generated_heatmap_id'] = generate_heatmap(board_id,bundle_entry_id,bundle_area_id,dataset_id)

    return jsonify(response_object)

@app.route('/generate_ranking_map/<board_id>', methods=['POST'])
def generate_ranking_map_call(board_id):
    response_object = {'status': 'success'}
    if request.method == 'POST':
        request_payload = request.get_json()
        bundle_area_id = request_payload['bundle_area']
        dataset_id = request_payload['dataset_id']
        response_object['generated_ranking_map_id'] = generate_ranking_map(board_id,bundle_area_id, dataset_id)

    return jsonify(response_object)


def generate_heatmap(board_id, bundle_entry_id, bundle_area_id, dataset_id, final_board_id = str(uuid.uuid1())):
    board = BOARDS[board_id]

    bundle_area = board.fetch_bundle(bundle_area_id)
    bundle_area_boxes = board.fetch_bundle_boxes(bundle_area_id)

    bundle_entry = board.fetch_bundle(bundle_entry_id)
    bundle_boxes_entry = board.fetch_bundle_boxes(bundle_entry_id)

    print("Slicing")

    new_boxes = copy.deepcopy(bundle_boxes_entry)
    temp_board, ranges = build_sliced_map(bundle_area_boxes, board.config, [bundle_entry], new_boxes)
    x_range, y_range = ranges

    print("Compiling Kill Data")

    bundle_boxes = new_boxes + bundle_area_boxes
    kills = compile_kill_data(dataset_id, [bundle_area] + temp_board.graph.bundles, bundle_boxes)

    attack_only_inside_area = kills[kills['Attacker_BSite'] == 1]
    attack_only_inside_entry = kills[kills['Attacker_BEntry'] == 1]
    victim_only_inside_area = kills[kills['Victim_BSite'] == 1]
    victim_only_inside_entry = kills[kills['Victim_BEntry'] == 1]
    fight_only_inside_area = pd.concat([attack_only_inside_area, attack_only_inside_entry,victim_only_inside_area,victim_only_inside_entry],ignore_index=True)

    keep_columns = ['Attacker_BSite','Victim_BSite','Attacker_BEntry','Victim_BEntry']
    for j in range(y_range):
        for i in range(x_range):
            if ('Attacker_' + str(i) + "_" + str(j)) in kills.columns:
                keep_columns.append('Attacker_' + str(i) + "_" + str(j))
            if ('Victim_' + str(i) + "_" + str(j)) in kills.columns:
                keep_columns.append('Victim_' + str(i) + "_" + str(j))
            if ('Attacker_' + str(i) + "_" + str(j) + "_t") in kills.columns:
                keep_columns.append(('Attacker_' + str(i) + "_" + str(j) + "_t"))
            if ('Victim_' + str(i) + "_" + str(j) + "_t") in kills.columns:
                keep_columns.append(('Victim_' + str(i) + "_" + str(j) + "_t"))
            if ('Attacker_' + str(i) + "_" + str(j) + "_b") in kills.columns:
                keep_columns.append(('Attacker_' + str(i) + "_" + str(j) + "_b"))
            if ('Victim_' + str(i) + "_" + str(j) + "_b") in kills.columns:
                keep_columns.append(('Victim_' + str(i) + "_" + str(j) + "_b"))
    columns_to_delete = [item for item in kills.columns.to_list() if item not in keep_columns]
    condensed_kills = fight_only_inside_area.drop(columns=columns_to_delete)

    aggregate_fights = condensed_kills.sum()
    aggregate_fights = pd.DataFrame(aggregate_fights).transpose()
    bundles_of_interest = set()
    for j in range(y_range):
        for i in range(x_range):
            bundle_name = str(i) + "_" + str(j)
            if ("Attacker_" + bundle_name) in aggregate_fights.columns:
                if aggregate_fights.iloc[0]["Attacker_"+ bundle_name] > 0 or aggregate_fights.iloc[0]["Victim_"+ bundle_name] > 0:
                    bundles_of_interest.add(bundle_name)

    columns_of_interest = ['Attacker_BEntry', 'Victim_BEntry']
    for bn in list(bundles_of_interest):
        columns_of_interest.append("Attacker_" + bn)
        columns_of_interest.append("Victim_" + bn)
    bundles_not_needed = sorted([item for item in condensed_kills.columns.to_list() if item not in columns_of_interest])
    condensed_bentry_fight_data = condensed_kills.drop(columns=bundles_not_needed)

    print("Calculating Rating")

    engagment_count = {}
    for row_entries in condensed_bentry_fight_data.iterrows():
        row = row_entries[1]
        if row["Attacker_BEntry"] == 1:
            found_victim_box = None
            for box in list(bundles_of_interest):
                if row["Victim_"+box] == 1:
                    found_victim_box = box
                    break
            if box not in engagment_count:
                engagment_count[box] = 0
            engagment_count[box] += 1
        elif row["Victim_BEntry"] == 1:
            found_attacked_box = None
            for box in list(bundles_of_interest):
                if row["Attacker_" + box] == 1:
                    found_attacked_box = box
                    break
            if box not in engagment_count:
                engagment_count[box] = 0
            engagment_count[box] += 1


    print(engagment_count)

    max_value = 0
    for _,count in engagment_count.items():
        if max_value < count:
            max_value = count

    engagment_rating = {}
    for box in engagment_count.keys():
        engagment_rating[box] = engagment_count[box] / max_value


    print("Making Final Board")

    new_bundles = [bundle_entry]
    new_boxes = bundle_boxes_entry
    new_links = []
    bundle_to_id = {}

    for bundle in engagment_rating.keys():

        bundle_uuid = str(uuid.uuid1())
        bundle_to_id[bundle] = bundle_uuid

        r_value = engagment_rating[bundle] * 255
        new_bn = Bundle(bundle_uuid,"",{'r': r_value, 'g': 0, 'b': 255})
        new_bundles.append(new_bn)

        boxes = temp_board.fetch_bundle_boxes_by_label(bundle)
        # if bundle == "5_9": print(len(boxes))

        for bx in boxes:
            box_uuid = str(uuid.uuid1())
            new_bx = Box(box_uuid,new_bn.id,bx.x1,bx.y1,bx.x2,bx.y2,[True,False])
            new_boxes.append(new_bx)


        link1 = Link(bundle_entry.id,new_bn.id)
        link2 = Link(new_bn.id,bundle_entry.id)
        new_links.append(link1)
        new_links.append(link2)
    new_graph = Graph(new_bundles,new_boxes,new_links)

    new_config = board.config
    new_config.bundle_label_config['show'] = False


    header = ["MatchId","RoundNum","Second","AttackerName","AttackerTeam","AttackerSide",
                "VictimName","VictimTeam","VictimSide","Weapon","IsWallshot",
                "IsFlashed","IsHeadshot"]
    fight_data = {}
    for bundle,id in bundle_to_id.items():
        attacker = fight_only_inside_area[fight_only_inside_area["Attacker_" +  bundle] ==1]
        victim = fight_only_inside_area[fight_only_inside_area["Victim_" +  bundle] ==1]
        fights_inside_bundle = pd.concat([attacker,victim], ignore_index=True)
        fight_info = []
        for index,row in fights_inside_bundle.iterrows():
            raw_data = [row[h] for h in header]
            # attacker_bundle, victim_bundle = [bundle,"BEntry"] if row["Attacker_"+bundle] else ["BEntry",bundle]
            # raw_data.append(attacker_bundle)
            # raw_data.append(victim_bundle)
            fight_info.append(raw_data)
        fight_data[id] = fight_info
    data = {
        # "header": header + ["AttackerBundle","VictimBundle"],
        "header": header,
        "data": fight_data
    }

    new_board = Board("Heatmap",final_board_id,new_config,new_graph,data)
    BOARDS[final_board_id] = new_board

    return final_board_id

def generate_ranking_map(board_id, bundle_area_id, dataset_id, final_board_id = str(uuid.uuid1())):
    board = BOARDS[board_id]

    bundle_area = board.fetch_bundle(bundle_area_id)
    bundle_area_boxes = board.fetch_bundle_boxes(bundle_area_id)

    print("Slicing")

    temp_board, ranges = build_sliced_map(bundle_area_boxes, board.config)
    x_range, y_range = ranges

    print("Compiling Kill Data")

    kills = compile_kill_data(dataset_id, [bundle_area] + temp_board.graph.bundles, bundle_area_boxes + temp_board.graph.boxes)

    # with pd.option_context('display.max_rows', None, 'display.max_columns', None):  # more options can be specified also
    #     print(kills)

    print("Calculating Box Ratings")


    attacked_from_site = kills[kills['Attacker_' + bundle_area.label] == 1]
    dead_from_site = kills[kills['Victim_' + bundle_area.label] == 1]
    fight_only_inside_site = pd.merge(attacked_from_site,dead_from_site,how='inner')
    fight_only_inside_site

    keep_columns = ['Attacker_' + bundle_area.label,'Victim_' + bundle_area.label]
    # print(kills.columns.to_list())
    for j in range(y_range):
        for i in range(x_range):
            if ('Attacker_' + str(i) + "_" + str(j)) in kills.columns:
                keep_columns.append('Attacker_' + str(i) + "_" + str(j))
            if ('Victim_' + str(i) + "_" + str(j)) in kills.columns:
                keep_columns.append('Victim_' + str(i) + "_" + str(j))
            if ('Attacker_' + str(i) + "_" + str(j) + "_t") in kills.columns:
                keep_columns.append(('Attacker_' + str(i) + "_" + str(j) + "_t"))
            if ('Victim_' + str(i) + "_" + str(j) + "_t") in kills.columns:
                keep_columns.append(('Victim_' + str(i) + "_" + str(j) + "_t"))
            if ('Attacker_' + str(i) + "_" + str(j) + "_b") in kills.columns:
                keep_columns.append(('Attacker_' + str(i) + "_" + str(j) + "_b"))
            if ('Victim_' + str(i) + "_" + str(j) + "_b") in kills.columns:
                keep_columns.append(('Victim_' + str(i) + "_" + str(j) + "_b"))


    columns_to_delete = [item for item in kills.columns.to_list() if item not in keep_columns]

    condensed_kills = fight_only_inside_site.drop(columns=columns_to_delete)

    # with pd.option_context('display.max_rows', None, 'display.max_columns', None):  # more options can be specified also
    #     print(condensed_kills)

    # aggregate_fights = condensed_kills.sum()
    # aggregate_fights = pd.DataFrame(aggregate_fights).transpose()

    aggregate_fights = condensed_kills.sum()
    aggregate_fights = pd.DataFrame(aggregate_fights).transpose()

    with pd.option_context('display.max_rows', None, 'display.max_columns', None):  # more options can be specified also
        print(aggregate_fights)

    bundles_of_interest = set()
    for j in range(y_range):
        for i in range(x_range):
            bundle_name = str(i) + "_" + str(j)
            if ("Attacker_" + bundle_name) in aggregate_fights.columns:
                if aggregate_fights.iloc[0]["Attacker_"+ bundle_name] > 0 or aggregate_fights.iloc[0]["Victim_"+ bundle_name] > 0:
                    bundles_of_interest.add(bundle_name)
            if ("Attacker_" + bundle_name + "_t") in aggregate_fights.columns:
                if aggregate_fights.iloc[0]["Attacker_"+ bundle_name + "_t"] > 0 or aggregate_fights.iloc[0]["Victim_"+ bundle_name + "_t"] > 0:
                    bundles_of_interest.add(bundle_name+"_t")
            if ("Attacker_" + bundle_name + "_b") in aggregate_fights.columns:
                if aggregate_fights.iloc[0]["Attacker_"+ bundle_name + "_b"] > 0 or aggregate_fights.iloc[0]["Victim_"+ bundle_name + "_b"] > 0:
                    bundles_of_interest.add(bundle_name+"_b")

    bundles_of_interest = list(bundles_of_interest)

    condensed_kills_0 = condensed_kills.copy(deep=True)
    columns_to_delete = [item for item in condensed_kills_0.columns.to_list() if item not in bundles_of_interest]
    keep_columns = []
    for j in range(y_range):
        for i in range(x_range):
            id = str(i) + "_" + str(j)
            if id in bundles_of_interest:
                keep_columns.append('Attacker_' + id)
                keep_columns.append('Victim_' + id)
            id_t = id + "_t"
            if id_t in bundles_of_interest:
                keep_columns.append('Attacker_' + id_t)
                keep_columns.append('Victim_' + id_t)
            id_b = id + "_b"
            if id_b in bundles_of_interest:
                keep_columns.append('Attacker_' + id_b)
                keep_columns.append('Victim_' + id_b)

    columns_to_delete = [item for item in condensed_kills_0.columns.to_list() if item not in keep_columns]

    condensed_kills_0 = condensed_kills_0.drop(columns=columns_to_delete)
    aggregate_kills = condensed_kills_0.sum()

    # print(bundles_of_interest)

    fight_rating = {}
    for bundle_id in bundles_of_interest:
        attacker_count = aggregate_kills["Attacker_" + bundle_id]
        victim_count = aggregate_kills["Victim_" + bundle_id]
        engagement_count = attacker_count + victim_count
        attacker_win_percent = attacker_count/engagement_count
        attacker_win_rating = attacker_win_percent * 100 * 1.99 - 99.9

        attacker_win_rating = int(attacker_win_rating)
        fight_rating[bundle_id] = attacker_win_rating

    # print(fight_rating)

    attacked_hash = {}
    victim_hash = {}
    for entry_row in fight_only_inside_site.iterrows():
        entry = entry_row[1]
        attacked_bundle = None
        victim_bundle = None
        for bundle_name, _ in fight_rating.items():
            if entry["Attacker_" + bundle_name] == 1:
                attacked_bundle = bundle_name
            if entry["Victim_" + bundle_name] == 1:
                victim_bundle = bundle_name
            if attacked_bundle and victim_bundle:
                break

        victim_name = entry['VictimName']
        attacked_name = entry['AttackerName']

        # with pd.option_context('display.max_rows', None, 'display.max_columns', None):  # more options can be specified also
        #     print(entry)
        # print(list(fight_only_inside_site.columns))
        # print(victim_name)
        if victim_name not in victim_hash:
            victim_hash[victim_name] = [fight_rating[victim_bundle]]
        else:
            victim_hash[victim_name].append(fight_rating[victim_bundle])

        if attacked_name not in attacked_hash:
            attacked_hash[attacked_name] = [fight_rating[attacked_bundle]]
        else:
            attacked_hash[attacked_name].append(fight_rating[attacked_bundle])

    list_of_players = list(set(list(attacked_hash.keys()) + list(victim_hash.keys())))

    attack_bias = 100
    victim_bias = 10

    player_ratings = {}
    for player_name in list_of_players:
        attacked_ratings = attacked_hash[player_name] if player_name in attacked_hash else []
        victim_ratings = victim_hash[player_name] if player_name in victim_hash else []
        attack_rating = sum([round((-x+100+attack_bias)/(200+attack_bias),3) for x in attacked_ratings])
        victim_rating = sum([round((x+100+victim_bias)/(200+victim_bias),3) for x in victim_ratings])
        player_ratings[player_name] = round(attack_rating - victim_rating,3)

    ratings = pd.DataFrame(columns = ['player_name','rating'])
    for player_name,rating in player_ratings.items():
        ratings = ratings.append({'player_name': player_name, 'rating':rating},
                               ignore_index = True)
    ratings = ratings.sort_values('rating',ascending=False)

    with pd.option_context('display.max_rows', None, 'display.max_columns', None):  # more options can be specified also
        print(ratings)


    print("Build Final Board")

    new_graph = board.graph.deepcopy()

    interesting_bundle = new_graph.bundles[0]
    header = ["PlayerName", "Rating"]
    ranking_data = []
    for index,row in ratings.iterrows():
        ranking_data.append([row['player_name'], row['rating']])
    print(ranking_data)
    data = {
        "header": header,
        "data":  {interesting_bundle.id : ranking_data}
    }

    new_board = Board("Rankings", final_board_id, board.config, new_graph, data)

    BOARDS[final_board_id] = new_board

    return final_board_id


def build_sliced_map(bundle_area_boxes, board_config, new_bundles=[], new_boxes = []):

    x_min = 10000
    x_max = -10000
    y_min = 10000
    y_max = -10000
    for box in bundle_area_boxes:
        x_box_min = min(box.x1,box.x2)
        x_box_max = max(box.x1,box.x2)
        if x_box_min < x_min:
            x_min = x_box_min
        if x_box_max > x_max:
            x_max = x_box_max

        y_box_min = min(box.y1,box.y2)
        y_box_max = max(box.y1,box.y2)
        if y_box_min < y_min:
            y_min = y_box_min
        if y_box_max > y_max:
            y_max = y_box_max


    JUMP = 150

    x_intercept = x_min
    y_intercept = y_max
    x_limit = x_max
    y_limit = y_min

    x_range = int((x_limit - x_intercept)/JUMP) + 1
    y_range = int((y_intercept - y_limit)/JUMP) + 1

    [x_range,y_range]

    overlaps_boxes = [
      {'x': 227.0, 'y': 2575.0},
      {'x': 521.0, 'y': 2043.0}
    ]
    z_split= 158.0

    def inside_overlap(x,y):
        return x >= overlaps_boxes[0]['x'] and x <= overlaps_boxes[1]['x'] and y >= overlaps_boxes[1]['y'] and y <= overlaps_boxes[0]['y']

    def inside_box(x,y,box_x1,box_y1, box_x2, box_y2):
        x_min = min(box_x1,box_x2)
        x_max = max(box_x1,box_x2)
        y_min = min(box_y1,box_y2)
        y_max = max(box_y1,box_y2)

        return x >= x_min and x <= x_max and y >= y_min and y <= y_max

    def boxes_overlap(box_1,box_2):
        box_1_minx = min(box_1["x1"],box_1["x2"])
        box_1_maxx = max(box_1["x1"],box_1["x2"])
        box_1_miny = min(box_1["y1"],box_1["y2"])
        box_1_maxy = max(box_1["y1"],box_1["y2"])

        box_2_minx = min(box_2["x1"],box_2["x2"])
        box_2_maxx = max(box_2["x1"],box_2["x2"])
        box_2_miny = min(box_2["y1"],box_2["y2"])
        box_2_maxy = max(box_2["y1"],box_2["y2"])

        return box_1_minx < box_2_maxx and box_1_maxx > box_2_minx and box_1_maxy > box_2_miny and box_1_miny < box_2_maxy

    corrected_overlap_box = {
        "x1" : overlaps_boxes[0]["x"],
        "x2" : overlaps_boxes[1]["x"],
        "y1" : overlaps_boxes[0]["y"],
        "y2" : overlaps_boxes[1]["y"]
    }

    box_coordinates = []
    for box in bundle_area_boxes:
        uber_box_dict = {
            "x1": min(box.x1,box.x2),
            "x2": max(box.x1,box.x2),
            "y1": min(box.y1,box.y2),
            "y2": max(box.y1,box.y2)
        }

        uber_box_in_overlap = boxes_overlap(uber_box_dict,corrected_overlap_box)

        overlap_data = {"present": uber_box_in_overlap}
        if uber_box_in_overlap:
            overlap_data['top'] = box.layers[0]
            overlap_data['bottom'] = box.layers[1]
        box_coordinates.append([uber_box_dict,overlap_data])

    # bundle_entry = board.fetch_bundle(bundle_entry_id)
    # bundle_boxes_entry = board.fetch_bundle_boxes(bundle_entry_id)

    # new_bundles = [bundle_entry]
    # new_boxes = copy.deepcopy(bundle_boxes_entry)
    for j in range(y_range):
        y1 = y_intercept - j * JUMP
        y2 = max(y_intercept - (j+1) * JUMP,y_limit)
        for i in range(x_range):
            x1 = x_intercept + i * JUMP
            x2 = min(x_intercept + (i+1) * JUMP,x_limit)

            sliced_box = {
                "x1":x1,
                "x2":x2,
                "y1":y1,
                "y2":y2
            }

            subset_overlap_data = { "present" : False }
            subset_boxes = []
            for [a_box_dict,overlap_data] in box_coordinates:
                if boxes_overlap(sliced_box,a_box_dict):
                    subset_box = {
                        "x1": max(x1,a_box_dict["x1"]),
                        "x2": min(x2,a_box_dict["x2"]),
                        "y1": max(y1,a_box_dict["y1"]),
                        "y2": min(y2,a_box_dict["y2"])
                    }
                    subset_boxes.append([subset_box["x1"],subset_box["x2"],subset_box["y1"],subset_box["y2"]])
                    if overlap_data["present"]:
                        if boxes_overlap(corrected_overlap_box,subset_box):
                            subset_overlap_data["present"] = True
                            if overlap_data["top"]:
                                subset_overlap_data["top"] = True
                            if overlap_data["bottom"]:
                                subset_overlap_data["bottom"] = True

            if subset_overlap_data["present"]:
                if "top" not in subset_overlap_data:
                    subset_overlap_data["top"] = False
                if "bottom" not in subset_overlap_data:
                    subset_overlap_data["bottom"] = False

            if len(subset_boxes) == 0:
                continue

            if i == 5 and j == 9:
                print(subset_boxes)

            if not subset_overlap_data["present"]:
                new_bundle_id = str(uuid.uuid1())
                new_bundle = Bundle(new_bundle_id,str(i) + '_' + str(j),{'r': 0, 'g': 0, 'b': 255})
                new_bundles.append(new_bundle)

                for [subset_box_x1,subset_box_x2,subset_box_y1,subset_box_y2] in subset_boxes:
                    new_box_id = str(uuid.uuid1())
                    new_box = Box(new_box_id, new_bundle_id, subset_box_x1, subset_box_y1, subset_box_x2, subset_box_y2, [True, False])
                    new_boxes.append(new_box)
            else:
                new_bundle_name = str(i) + '_' + str(j)

                if subset_overlap_data["top"]:
                    new_bundle_id = str(uuid.uuid1())
                    if subset_overlap_data["bottom"]:
                        # There is another bundle below; identify new bundle as top
                        new_bundle_name += "_t"
                    new_bundle = Bundle(new_bundle_id,new_bundle_name,{'r': 0, 'g': 0, 'b': 255})
                    new_bundles.append(new_bundle)

                    for [subset_box_x1,subset_box_x2,subset_box_y1,subset_box_y2] in subset_boxes:
                        new_box_id = str(uuid.uuid1())
                        new_box = Box(new_box_id, new_bundle_id, subset_box_x1, subset_box_y1, subset_box_x2, subset_box_y2, [True, False])
                        new_boxes.append(new_box)

                if subset_overlap_data["bottom"]:
                    new_bundle_id = str(uuid.uuid1())
                    if subset_overlap_data["top"]:
                        # There is another bundle above; identify new bundle as bottom
                        new_bundle_name += "_b"
                    new_bundle = Bundle(new_bundle_id,new_bundle_name,{'r': 0, 'g': 0, 'b': 255})
                    new_bundles.append(new_bundle)

                    for [subset_box_x1,subset_box_x2,subset_box_y1,subset_box_y2] in subset_boxes:
                        new_box_id = str(uuid.uuid1())
                        new_box = Box(new_box_id, new_bundle_id, subset_box_x1, subset_box_y1, subset_box_x2, subset_box_y2, [False, True])
                        new_boxes.append(new_box)



    temp_graph = Graph(new_bundles,new_boxes,[])
    temp_board = Board(None,"tmp",board_config,temp_graph,[])

    return [temp_board, [x_range,y_range]]


def compile_kill_data(dataset_id, bundles, bundle_boxes):
    parsed_kills_csvs = []
    dataset_path = "./parsed_demos_" + str(dataset_id)

    demo_dirs = [dir for dir in os.listdir(dataset_path) if dir != "metadata.json"]
    li = []
    for dd in demo_dirs:
        demo_path = dataset_path + "/" + dd + '/' + dd + "-kills.csv"
        demo_path = str(demo_path)
        df = pd.read_csv(demo_path, index_col=None, header=0)
        li.append(df)

    kills = pd.concat(li, axis=0, ignore_index=True)


    attacker_coor = []
    victim_coor = []
    for k in kills.iterrows():
        attacker_coor.append([k[1]['AttackerX'],k[1]['AttackerY'],k[1]['AttackerZ']])
        victim_coor.append([k[1]['VictimX'],k[1]['VictimY'],k[1]['VictimZ']])

    overlaps_boxes = [
          {'x': 227.0, 'y': 2575.0},
          {'x': 521.0, 'y': 2043.0}
        ]
    z_split= 158.0

    def inside_overlap(x,y):
        return x >= overlaps_boxes[0]['x'] and x <= overlaps_boxes[1]['x'] and y >= overlaps_boxes[1]['y'] and y <= overlaps_boxes[0]['y']

    def inside_box(x,y,box_x1,box_y1, box_x2, box_y2):
        x_min = min(box_x1,box_x2)
        x_max = max(box_x1,box_x2)
        y_min = min(box_y1,box_y2)
        y_max = max(box_y1,box_y2)

        return x >= x_min and x <= x_max and y >= y_min and y <= y_max

    # for i,bund in enumerate([bundle_area] + new_bundles):
    for i, bund in enumerate(bundles):
        bundle_id = bund.id
        bundle_name = bund.label

        # box_filter = [bx for bx in (new_boxes + bundle_area_boxes) if bx.bundle_id == bund.id]
        box_filter = [bx for bx in bundle_boxes if bx.bundle_id == bund.id]

        in_bundle_list = []

        box_contents = []
        for box in box_filter:
            box_contents.append([box.x1, box.x2, box.y1, box.y2, box.layers[0], box.layers[1]])

        for [attacker_x,attacker_y,attacker_z] in attacker_coor:
            in_bundle = False

            within_overlap = inside_overlap(attacker_x, attacker_y)

            for [x1,x2,y1,y2,top,bottom] in box_contents:
                in_bundle = inside_box(attacker_x,attacker_y,x1,y1,x2,y2)

                if within_overlap and in_bundle:
                    if not top and attacker_z > z_split:
                        in_bundle = False
                    elif not bottom and attacker_z < z_split:
                        in_bundle = False
                if in_bundle: break

            in_bundle_list.append(1 if in_bundle else 0)


        print('JList')
        print(in_bundle_list)

        kills["Attacker_" + bundle_name] = in_bundle_list


        in_bundle_list = []
        for [victim_x,victim_y,victim_z] in victim_coor:
            in_bundle = False

            within_overlap = inside_overlap(victim_x,victim_y)

            for [x1,x2,y1,y2,top,bottom] in box_contents:
                in_bundle = inside_box(victim_x,victim_y,x1,y1,x2,y2)

                if within_overlap and in_bundle:
                    if not top and victim_z > z_split:
                        in_bundle = False
                    elif not bottom and victim_z < z_split:
                        in_bundle = False
                if in_bundle: break

            in_bundle_list.append(1 if in_bundle else 0)
        # print(bundle_name)
        # print(in_bundle_list)

        kills["Victim_" + bundle_name] = in_bundle_list

    return kills





def create_demo_data(demoset_id, demo_file_name):
    demo_str = "".join(RAW_DEMO[demoset_id])
    demo_str += "=="

    demo_byte = demo_str.encode('ascii')
    decoded_byte = base64.decodebytes(demo_byte)

    tmp_demo_path = "tmp_demos/" + demo_file_name
    tmp_path = open(tmp_demo_path, "wb")
    tmp_path.write(decoded_byte)
    tmp_path.close()

    demo_parser = DemoParser(demofile = tmp_demo_path, match_id = demo_file_name)
    demo_data = demo_parser.parse()

    base_dir_path = "parsed_demos_" + demoset_id
    if not os.path.exists(base_dir_path):
        os.makedirs(base_dir_path)
        metadata_path = base_dir_path + '/metadata.json'
        with open(metadata_path, 'w') as outfile:
            json.dump({'title':demoset_id}, outfile)

    demo_name_without_suffix = demo_file_name.replace(".dem","")
    demo_dir_path = base_dir_path + "/" + demo_name_without_suffix

    if not os.path.exists(demo_dir_path):
        os.makedirs(demo_dir_path)

    demo_data["Rounds"].to_csv(demo_dir_path + "/" + demo_name_without_suffix + '-rounds.csv',index=False)
    demo_data["Kills"].to_csv(demo_dir_path + "/" + demo_name_without_suffix + '-kills.csv',index=False)
    demo_data["Damages"].to_csv(demo_dir_path + "/" + demo_name_without_suffix + '-damages.csv',index=False)
    demo_data["Grenades"].to_csv(demo_dir_path + "/" + demo_name_without_suffix + '-grenades.csv',index=False)
    demo_data["BombEvents"].to_csv(demo_dir_path + "/" + demo_name_without_suffix + '-bomb-events.csv',index=False)
    demo_data["Footsteps"].to_csv(demo_dir_path + "/" + demo_name_without_suffix + '-footsteps.csv',index=False)

    os.remove(tmp_demo_path)


def decipher_payload(board_id, post_payload):

    board_title = post_payload['title']

    # Config
    config_payload = post_payload['config']

    bundle_default_color = config_payload['bundle_default_color']
    bundle_label_config = config_payload['bundle_label_config']
    bundle_selected_indicator = config_payload['bundle_selected_indicator']
    box_configurable = config_payload['box_configurable']

    config = Config(bundle_default_color,bundle_label_config,bundle_selected_indicator,box_configurable)


    # Graph
    graph_payload = post_payload['graph']

    bundles = []
    bundles_payload = graph_payload['bundles']
    for b_payload in bundles_payload:
        bundle_id = b_payload['id']
        bundle_label = b_payload['label']
        bundle_color = b_payload['color']
        new_bundle = Bundle(bundle_id, bundle_label, bundle_color)
        bundles.append(new_bundle)



    boxes = []
    boxes_payload = graph_payload['boxes']
    for b_payload in boxes_payload:
        box_id = b_payload['id']
        bundle_id = b_payload['bundle_id']
        x1 = b_payload['x1']
        y1 = b_payload['y1']
        x2 = b_payload['x2']
        y2 = b_payload['y2']
        layers = b_payload['layers']
        new_box = Box(box_id, bundle_id, x1, y1, x2, y2,layers)
        boxes.append(new_box)

    links = []
    links_payload = graph_payload['links']
    for l_payload in links_payload:
        bundle0_id = l_payload['bundle0_id']
        bundle1_id = l_payload['bundle1_id']
        new_link = Link(bundle0_id, bundle1_id)
        links.append(new_link)

    new_graph = Graph(bundles, boxes, links)

    # Data
    data_payload = post_payload['data']


    new_board = Board(board_title, board_id, config, new_graph, data_payload)

    return new_board

def remove_board(board_id):
    BOARDS.pop(board_id, None)



if __name__ == '__main__':
    app.run()
