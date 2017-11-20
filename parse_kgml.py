import os
from xml.etree import ElementTree as ET
import json
import csv
from collections import defaultdict
from Bio.KEGG.REST import kegg_get
import re

import argparse

def parse_faa_header(faa_file):
    '''
    given a .faa file, extract header information
    e.g. >cg_0.2_sub10_scaffold_354_c_9 MazF family transcriptional 
    regulator; K07171 mRNA interferase [EC:3.1.-.-] Tax=CG_Elusi_05 
    id=91920324 bin="CG1_02_SUB10_Elusimicrobia_37_114_curated" 
    species=CG_Elusi_05 genus=unknown taxon_order=unknown
    taxon_class=unknown phylum=Elusimicrobia organism_tax=CG_Elusi_05,
     Elusimicrobia, Bacteria
    return {kegg_id: K07171, bin:CG1_02_SUB10_Elusimicrobia_37_114_curated,
     species: CG_Elusi_05, genus: unknown, class: unknown, 
     phylum: Elusimicrobia}
    '''
    with open(faa_file) as f:
        entry_list = f.read().split("\n") 


    Regex_Pattern_id = r"(?<=;\s)\w+(?=\s)"
    Regex_Pattern_bin = r"(?<=\").+(?=\")"
    Regex_Pattern_species = r"(?<=species=)(\w+)(?=\s)"
    Regex_Pattern_genus = r"(?<=genus=)\w+(?=\s)"
    Regex_Pattern_class = r"(?<=taxon_class=)\w+(?=\s)"
    Regex_Pattern_phylum = r"(?<=phylum=)\w+(?=\s)" 

    dictionary_list = []
    
    for i in entry_list:
        dictionary = {}
        kegg_ID = ''.join(re.findall(Regex_Pattern_id, i))
        kegg_bin = ''.join(re.findall(Regex_Pattern_bin, i))
        species = ''.join(re.findall(Regex_Pattern_species, i))
        genus = ''.join(re.findall(Regex_Pattern_genus, i))
        Class = ''.join(re.findall(Regex_Pattern_class, i))
        phylum = ''.join(re.findall(Regex_Pattern_phylum, i))
        dictionary["id"] = kegg_ID
        dictionary["bin"] = kegg_bin
        dictionary["species"] = species
        dictionary["genus"] = genus
        dictionary["class"] = Class
        dictionary["phylum"] = phylum
        dictionary_list.append(dictionary)
        dictionary = {}
        
    return dictionary_list


def get_kegg_name(id_name):
    '''
    take a KEGG id, e.g. C00014 or K10534 or R00796
    return its name
    '''
    resp = kegg_get(id_name)
    lines = resp.read().split("\n")
    nameidx = -1
    for idx, line in enumerate(lines):
        if line.startswith("NAME"):
            nameidx = idx
    output = [lines[nameidx][5:].lstrip()]
    for line in lines[nameidx+1:]:
        if line.startswith(" "):
            output = output + [line.lstrip()]
        else:
            break
    for idx, name in enumerate(output):
        output[idx] = name.replace(";","")
    return output[0]
    
def parse_xml(path):
    root = ET.parse(path)
    pathway = root.getroot()
    reaction_tree = pathway.findall("reaction")
    # list of dictionaries
    reaction_nodes = []
    # list of dictionaries
    edges = []
    for reactions in reaction_tree:
        reaction_id = reactions.attrib['id']
        reaction_name = reactions.attrib['name']
        reaction_type = 'reaction'
        ortholog_name = pathway.find("entry[@reaction='{0}']".format(reaction_name)).attrib['name']
        reaction_name = reaction_name.split(" ")
        for names in reaction_name:
            entry = {"id": names[3:], "ortholog_id": [x[3:] for x in ortholog_name.split(" ")], "type": reaction_type}
            if not any(d['id'] == names for d in reaction_nodes):
                reaction_nodes.append(entry)
            else:
                index = [i for i,_ in enumerate(reaction_nodes) if _['id'] == names][0]
                reaction_nodes[index]["ortholog_id"] += entry["ortholog_id"]
        rxn_substrate = [x for x in reactions.findall("substrate")]
        rxn_product = [x for x in reactions.findall("product")]
        for substrates in rxn_substrate:
            substrate_name = substrates.attrib['name']
            substrate_id = substrates.attrib['id']
            substrate_type = (pathway.find("entry[@id='{0}']".format(substrate_id))).attrib['type']
            reaction_nodes.append({'id': substrate_name.split(':')[1], 'type': substrate_type})
            for products in rxn_product:
                product_name = products.attrib['name']
                product_id = products.attrib['id']
                product_type = pathway.find("entry[@id='{0}']".format(product_id)).attrib['type']
                reaction_nodes.append({'id': product_name.split(':')[1], 'type': product_type})
                # Add the edge data to the list of edges
                for names in reaction_name:
                    edges.append({'source': substrate_name.split(':')[1], 'target': names[3:]})
                    edges.append({'source': names[3:], 'target': product_name.split(':')[1]})
    return reaction_nodes, edges


def attach_names_to_node(node):
    node_id = node['id']#get the id from node
    itm_name=get_kegg_name(node_id)#get the name by using id
    print 'got name: ', itm_name
    node.update(name=itm_name)#update the node with new key name 
    if node['type'] == 'reaction': #if the node is a reaction node
        orth_ids = node["ortholog_id"]#get the ortholog id
        if len(orth_ids) == 0:
            return # skip if it does not have ortholog id
        orth_name=get_kegg_name(orth_ids[0]) #get the ortholog name using the first ortholog id
        print 'got orth_name: ', orth_name
        node.update(ortholog_name=orth_name) #add the new key and value to the dictionary

def attach_bins_to_node(nodes, faa_headers):
    nodes_dict = {ortholog_id: node
                    for node in nodes if node['type'] == 'reaction'
                    for ortholog_id in node['ortholog_id']
                    }
    for header in faa_headers:
        bin_name = header['bin']
        kegg_id = header['id']
        if kegg_id not in nodes_dict:
            continue
        node = nodes_dict[kegg_id]
        if 'bins' not in node:
            node['bins'] = []
        if bin_name not in set([b['name'] for b in node['bins']]):
            node['bins'].append({'name':bin_name, 'count':1})
import sys
if __name__ == '__main__':
    if len(sys.argv) != 4:
        print ('argument: <KGML file> <faa header file> <output>')
        print 'This script processes KGML and faa header file (from grep ">" my_proteins.faa),'\
            'and writes a json representation of bin annotated reaction graph to <output>'
    reaction_nodes, edges = parse_xml(sys.argv[1])
    # import pdb; pdb.set_trace()
    nodes_with_neighbours = {node_id for e in edges for node_id in [e['source'], e['target']]}
    reaction_nodes = [n for n in reaction_nodes if n['id'] in nodes_with_neighbours]
    faa_headers = parse_faa_header(sys.argv[2])
    print 'faa header length', len(faa_headers)
    attach_bins_to_node(reaction_nodes, faa_headers)
    print 'using kegg api to get names'
    for node in reaction_nodes:
        attach_names_to_node(node)
    graph = {
        'nodes': reaction_nodes,
        'links': edges
    }
    with open(sys.argv[3],'w') as f:
        f.write(json.dumps(graph))
            